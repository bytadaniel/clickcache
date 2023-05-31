/* eslint-disable no-async-promise-executor */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable no-constant-condition */
import { EventEmitter } from 'stream'
import { Chunk } from './chunk'
import { ResolverOptions, InsertRow } from './interface'
import { CacheError } from './errors'
import { Events, E_CODES } from './constants'
import { sleep, uniqBy } from './utils'
import { ChunkTracker } from './chunk-tracker/chunk-tracker'
import { DataWatcher } from './watchers/abstract'
import { Queue } from './queue/queue'

type OnResolved = (chunk: Chunk) => void
type OnResolvedAsync = (chunk: Chunk) => Promise<void>

/**
 * ChunkResolver is the central element of the application,
 * which implements all the logic of working with the caching process
 * and provides an API for interacting "outside"
 */
export class ChunkResolver {
	#chunkTracker: ChunkTracker
	#emitter: EventEmitter
	#options: ResolverOptions
	#interval: NodeJS.Timer
	#allowCache: boolean
	#watchQueue: boolean

	/**
	 * Create ChunkResolver instance
	 * 
	 * @param {DataWatcher} dataWatcher any type of watcher
	 * @param {ResolverOptions} options 
	 */
	constructor (dataWatcher: DataWatcher, options: ResolverOptions) {
		this.#chunkTracker = new ChunkTracker(dataWatcher)
		this.#options = options

		this.#chunkTracker.setTtlMs(options.ttlMs)
		this.#chunkTracker.setMaxSize(options.maxSize)
		
		this.#allowCache = true
		this.#emitter = new EventEmitter()

		this.#watchQueue = false
		this.#interval = {} as NodeJS.Timer // pass
		this.#start() // create real NodeJS.Timer
	}

	/**
	 * Private method to resolve chunks
	 * 1. Iterating evety chunk of every table to check
	 * - if c hunck is overfilledby rows and reached the limit
	 * - if chunk is expired by time
	 * 
	 * 2. Block all matched chunks
	 * 3. Delete chunks from store
	 * 4. Throwing then outside
	 */
	#resolveConditionally () {
		let availableChunks = 0
		for (const table of this.#chunkTracker.getTables()) {
			const currentPoolSnapshot = this.#chunkTracker.getChunks(table)

			availableChunks += currentPoolSnapshot.length
	
			const expiredChunks = currentPoolSnapshot.filter(chunk => chunk.isExpired())
			const overfilledChunks = currentPoolSnapshot.filter(chunk => chunk.isOverfilled(this.#chunkTracker.maxSize))
	
			expiredChunks.forEach(chunk => chunk.block())
			overfilledChunks.forEach(chunk => chunk.block())
	
			const resolveChunks = uniqBy([...expiredChunks, ...overfilledChunks], chunk => chunk.id)
	
			this.#chunkTracker.removeChunks(table, resolveChunks.map(chunk => chunk.id))
	
			resolveChunks.forEach(chunk => this.#emitter.emit(Events.ChunkResolved, chunk))
		}

		if (!availableChunks) {
			clearInterval(this.#interval)
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
	public async cache (table: string, rows: InsertRow[]) {
		this.#start()

		if (!this.#allowCache) {
			throw new CacheError(E_CODES.E_CACHE_FORBIDDEN)
		}
		const unblockedChunk = this.#chunkTracker.getUnblockedChunk(table)

		await unblockedChunk.$appendRows([...rows])

		if (unblockedChunk.isExpired() || await unblockedChunk.isOverfilled(this.#chunkTracker.getMaxSize())) {
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

		this.#chunkTracker.getTables().forEach(table => {
			this.#chunkTracker.getChunks(table).forEach(chunk => {
				chunk.block()
				this.#chunkTracker.removeChunk(table, chunk.id)
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
	 * Registers a listener for completely resolved chunks, allowing asynchronous processing.
	 * This method continuously checks for resolved chunks in a queue and invokes the provided `onResolved` callback asynchronously for each chunk.
	 * 
	 * @param {OnResolvedAsync} onResolved - The asynchronous callback function to be invoked for each resolved chunk.
	 */
	public onAsyncResolved (onResolved: OnResolvedAsync) {
		const queue = new Queue<Chunk>()
		this.#emitter.on(Events.ChunkResolved, (chunk: Chunk) => queue.enqueue(chunk))

		new Promise(async () => {
			while (this.#watchQueue) {
				if (queue.isEmpty()) {
					await sleep(this.#options.checkIntervalMs)
					continue
				}
	
				await onResolved(queue.dequeue()!)
			}
		})
	}

	/**
	 * Service method to start pending
	 */
	#start () {
		this.#watchQueue = true
		this.#interval = setInterval(() => this.#resolveConditionally(), this.#options.checkIntervalMs)
	}

	/**
	 * Service method to cleanup memory
	 */
	public stop () {
		this.#watchQueue = false
		clearInterval(this.#interval)
	}
}
