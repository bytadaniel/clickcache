/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable no-async-promise-executor */
import cuid from 'cuid'
import { Chunk } from './chunk/chunk'
import { ResolverOptions, InsertRow } from './interface'
import { E_CODES } from './constants'
import { ChunkRegistry } from './chunk-registry'
import { DataWatcher } from './watchers/abstract'
import { Queue } from './queue/queue'
import { ScratchChunk } from './chunk/scratch-chunk'
import { DiskWatcher } from './watchers/disk.watcher'
import { ProcessWatcher } from './watchers/process.watcher'
import { ChunkFacade } from './chunk/chunk-facade'
import { CacheError } from './errors'
import { sleep } from './utils'
import { ConfigError } from './errors/config.error'

type OnResolved = (chunk: ChunkFacade) => void
type OnResolvedAsync = (chunk: ChunkFacade) => Promise<void>

/**
 * ChunkResolver is the central element of the application,
 * which implements all the logic of working with the caching process
 * and provides an API for interacting "outside"
 */
export class ChunkResolver {
	readonly #dataWatcher: DataWatcher
	readonly #registry: ChunkRegistry
	readonly #options: ResolverOptions
	readonly #handlers: Map<string, OnResolved | OnResolvedAsync>

	#toResolveQueue: Queue<Chunk>
	#watchingToResolveQueue: boolean
	#watchingRegistry: boolean

	/**
	 * Create ChunkResolver instance
	 * 
	 * @param {ResolverOptions} options 
	 */
	constructor (options: ResolverOptions) {
		const registry = new ChunkRegistry()

		let dataWatcher: DataWatcher
		switch (options.dataWatcher) {
			case 'disk':
				if (!options.disk) {
					throw new ConfigError(E_CODES.E_CONFIG_PARAM_REQUIRED)
				}
				dataWatcher = new DiskWatcher(registry, {
					disk: options.disk,
					chunkSize: options.chunkSize
				})
				break	
			case 'process':
				dataWatcher = new ProcessWatcher(registry, {
					chunkSize: options.chunkSize
				})
				break
		}
		
		/**
		 * Registry is a brain of the package
		 * It stores metadata and relations and shares it to every part of system
		 */
		this.#registry = registry
		/**
		 * Data watcher is "the hands" off the package
		 * It allows to this class to interact with stored data (memory, disk or cloud)
		 */
		this.#dataWatcher = dataWatcher
		this.#options = options

		this.#watchingToResolveQueue = false
		this.#watchingRegistry = false
	

		this.#handlers = new Map<string, OnResolved | OnResolvedAsync>()

		/**
		 * There is defined a queue to proceed chunks consistently
		 */
		this.#toResolveQueue = new Queue<Chunk>()

		/**
		 * On init we have to restore already existing data from watcher
		 * and start pending
		 */
		dataWatcher.restore().then(async () => {
			await this.#startWatching()
		})
	}

	/**
	 * A method to start a loop to check there are chunks in our registry
	 */
	async #startWatchingRegistry() {
		if (!this.#watchingRegistry) {
			this.#watchingRegistry = true
			await this.#watchRegistry()
		}
	}

	/**
	 * It searches in a loop for come chunks which are ready to be resolved
	 * The chunk is considered to be resolved if:
	 * - it is expired by the time
	 * - it has reached the size limit
	 * - it is consistent (i.e it has no running async operations currently)
	 * 
	 * When the chunk matches conditions,
	 * the system removes it from registry and puts to a resolve queue
	 */
	async #watchRegistry () {
		while (!this.#registry.isEmpty()) {
			const snapshot = this.#registry.getAll()

			for (const state of snapshot) {
				const isExpired = state.chunkRef.isExpired()
				const isOverfilled = state.chunkRef.isOverfilled(this.#options.chunkSize)
				const isConsistent = state.chunkRef.isConsistent()

				const canBlock = isExpired || isOverfilled
				const canResolve = isConsistent && (isExpired || isOverfilled)

				if (canBlock) {
					state.chunkRef.block()
				}

				if (canResolve) {
					this.#registry.unregister(state.chunkRef.id)
					this.#toResolveQueue.enqueue(state.chunkRef)
					await this.#startWatchingToResolveQueue()
				}

				await sleep(this.#options.checkIntervalMs)
			}
		}
		this.#watchingRegistry = false
	}

	/**
	 * A method to start a loop to pass chunks outside and resolve
	 */
	async #startWatchingToResolveQueue() {
		if (!this.#watchingToResolveQueue) {
			this.#watchingToResolveQueue = true
			await this.#watchToResolveQueue()
		}
	}

	/**
	 * It handles chunks in a loop, one by one from queue
	 * To pass chunk outside and then resolves it
	 * 
	 * Resolve is a required process to clenup chunk data from storage (process memory, disk space or cloud)
	 */
	async #watchToResolveQueue () {
		while (!this.#toResolveQueue.isEmpty()) {
			const chunk = this.#toResolveQueue.dequeue()
			if (!chunk) {
				continue
			}

			const handlers = [...this.#handlers.entries()]

			if (!handlers.length) {
				/**
				 * there is no any handler to pass rows
				 * stop next steps to avoid data lose
				 */
				throw new CacheError(E_CODES.E_NO_HANDLER)
			}

			// return to queue if chunk has inconsistent state
			if (!chunk.isConsistent()) {
				this.#toResolveQueue.enqueue(chunk)
				continue
			}

			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			for (const [_handlerId, handler] of handlers) {
				await handler(new ChunkFacade(chunk))
			}

			await chunk.resolve()
		}
		this.#watchingToResolveQueue = false
	}

	/**
	 * Pass your data in this method to store it
	 * 
	 * It registers data in the system registry and saves it though the chosen data watcher
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
		while (rows.length > 0) {
			let chunk = this.#registry.getAll().find(state => state.chunkRef.isUnblocked())?.chunkRef
			if (!chunk) {
				chunk = new ScratchChunk(this.#dataWatcher, {
					table,
					liveAtLeastMs: this.#options.chunkLifeMs
				})
				this.#registry.register(chunk)
			}

			const rowCountToOverfill = Math.abs(this.#options.chunkSize - chunk.size)

			const chunkRows = rows.splice(0, rowCountToOverfill)

			/**
			 * This operation has to append rows to your watcher storage
			 * For example, if you use disk storage, the system needs to make some save stuff
			 * and we should consider that chunk is inconsistent while this stuff is not done 
			 */
			chunk.setConsistency(false)
			await this.#dataWatcher.save({
				chunkRef: chunk,
				insertRows: chunkRows
			})
			chunk.setConsistency(true)
		}

		this.#startWatching()
	}

	/**
	 * It registers a hadnler for resolved chunks
	 * Pass @sync or @async callback and use it to save data to your DBMS
	 */
	public onResolved(onResolved: OnResolved | OnResolvedAsync) {
		this.#handlers.set(cuid(), onResolved)
	}

	/**
	 * Service method to start pending
	 */
	async #startWatching () {
		await this.#startWatchingRegistry()
		await this.#startWatchingToResolveQueue()
	}
}
