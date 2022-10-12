import { uniqBy } from 'lodash'
import { EventEmitter } from 'stream'
import { Chunk } from './сhunk'
import { ResolverOptions, InsertRow } from './interface'
import { ChunkPool } from './pool'
import { CacheError } from './errors'
import { Events, E_CODES } from './constants'

type OnResolved = (chunk: Chunk) => void | Promise<void>

/**
 * ChunkResolver is the central element of the application,
 * which implements all the logic of working with the caching process
 * and provides an API for interacting "outside"
 */
export class ChunkResolver {
	#pool: ChunkPool
	#emitter: EventEmitter
	#options: ResolverOptions
	#interval: NodeJS.Timer
	#allowCache: boolean

	/**
	 * Create ChunkResolver instance
	 * 
	 * @param {ChunkPool} chunkPool any type of pool
	 * @param {ResolverOptions} options 
	 */
	constructor (chunkPool: ChunkPool, options: ResolverOptions) {
		this.#pool = chunkPool
		this.#options = options

		this.#pool.setTtlMs(options.ttlMs)
		this.#pool.setMaxSize(options.maxSize)
		
		this.#allowCache = true
		this.#emitter = new EventEmitter()
		this.#interval = setInterval(() => this.#resolveConditionally(), this.#options.checkIntervalMs)
	}

	/**
	 * Private method to resolve chunks
	 * 1. Iterating evety chunk of every table to check
	 * - if chunck is overfilled by rows and reached the limit
	 * - if chunk is expired by time
	 * 
	 * 2. Block all matched chunks
	 * 3. Delete chunks from store
	 * 4. Throwing then outside
	 */
	#resolveConditionally () {
		for (const table of this.#pool.getTables()) {
			const currentPoolSnapshot = this.#pool.getChunks(table)
	
			const expiredChunks = currentPoolSnapshot.filter(chunk => chunk.isExpired())
			const overfilledChunks = currentPoolSnapshot.filter(chunk => chunk.isOverfilled(this.#pool.maxSize))
	
			expiredChunks.forEach(chunk => chunk.block())
			overfilledChunks.forEach(chunk => chunk.block())
	
			const resolveChunks = uniqBy([...expiredChunks, ...overfilledChunks], chunk => chunk.id)
	
			this.#pool.removeChunks(table, resolveChunks.map(chunk => chunk.id))
	
			resolveChunks.forEach(chunk => this.#emitter.emit(Events.ChunkResolved, chunk))
		}
	}

	/**
	 * Delayed insertion
	 * 
	 * @warning This method does not guarantee the validation of the transmitted data,
	 * which may subsequently affect the outcome of inserting a chunk into the DBMS.
	 * Be confident to validate it inself
	 * 
	 * @param {Table} table table name
	 * @param {InsertRow[]} rows list of rows
	 * @returns 
	 */
	public cache (table: string, rows: InsertRow[]) {
		if (!this.#allowCache) {
			throw new CacheError(E_CODES.E_CACHE_FORBIDDEN)
		}
		const unblockedChunk = this.#pool.getUnblockedChunk(table)
		unblockedChunk.appendRows([...rows])

		if (unblockedChunk.isExpired() || unblockedChunk.isOverfilled(this.#pool.getMaxSize())) {
			unblockedChunk.block()
		}

		return unblockedChunk
	}

	/**
	 * Public method to resolve chunks
	 * You can use it to provide graceful shutdown with forse insertion of all stored data
	 * 
	 * 1. Prohibition of caching in case if there is some concurrent workers
	 * 2. Blocking all chunks to avoid concurrent insertion of rows
	 * 3. Extracting all chunks from the store
	 * 4. Throwing all chunks outside
	 * 
	 * @warning SIGKILL code can't be handled in Node and will lead you to loss of data
	 */
	public resolveImmediately () {
		this.#allowCache = false
		this.stop()
		this.#pool.getTables().forEach(table => {
			this.#pool.getChunks(table).forEach(chunk => {
				chunk.block()
				this.#pool.removeChunk(table, chunk.id)
				this.#emitter.emit(Events.ChunkResolved, chunk)
			})
		})
	}

	/**
	 * Wrapping emitter to handle completely resolved chunks
	 * There you can bridge this cacher with your codebase and finish your insertion staff
	 * 
	 * @param {Function} onResolved
	 */
	public onResolved (onResolved: OnResolved) {
		this.#emitter.on(Events.ChunkResolved, (chunk: Chunk) => onResolved(chunk))
	}

	/**
	 * Service method to cleanup memory
	 */
	public stop () {
		clearInterval(this.#interval)
	}
}
