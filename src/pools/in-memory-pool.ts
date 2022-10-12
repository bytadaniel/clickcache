import { Chunk } from '../сhunk'
import { Table, ChunkId } from '../interface'
import { ChunkPool } from '../pool'

/**
 * InMemoryPool is a subset of ChunkPool abstraction
 * This pool saves rows in chunks that are stored in process memory
 * 
 * @warning storing data in process memory can lead you to LOSS OF CONSISTANCE
 * but instead of this disadvantage you gain the cheapest and the most simple way to work
 * with clickhouse
 * 
 * Data loss can only occur in two cases:
 * 1. When OS sends to a process SIGKILL code which is killing your process without grace
 * 2. When some piece of data contains anomalies such as `undefined` etc
 */
export class InMemoryPool extends ChunkPool {
	#chunks: Map<Table, Set<Chunk>>

	/**
	 * Create InMemoryPool instance
	 */
	constructor () {
		super()
		this.#chunks = new Map<Table, Set<Chunk>>()
	}

	/**
	 * Get current or created table chunk set
	 *  
	 * @param {Table} table table name
	 * @returns {Set<Chunk>} set of chunks
	 */
	#getAssertedTablePool (table: Table): Set<Chunk> {
		if (!this.#chunks.has(table)) {
			this.#chunks.set(table, new Set())
		}
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		return this.#chunks.get(table)!
	}

	/**
	 * Add new chunk to table set
	 * 
	 * @param {Table} table table name
	 * @param {Chunk} chunk ref
	 */
	public appendChunk (table: Table, chunk: Chunk) {
		const tablePool = this.#getAssertedTablePool(table)
		if (!tablePool.has(chunk)) {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			this.#chunks.get(table)!.add(chunk)
		}
	}

	/**
	 * Remove your chunk from table set
	 * 
	 * @param {Table} table tableName
	 * @param {ChunkId} id chunk unique id 
	 */
	public removeChunk (table: Table, id: ChunkId) {
		const tablePool = this.#getAssertedTablePool(table)

		for (const chunk of tablePool.values()) {
			if (chunk.id === id) {
				tablePool.delete(chunk)
				break
			}
		}
	}

	/**
	 * Remove a list of chunks from table set
	 * 
	 * @param {Table} table table name
	 * @param {ChunkId[]} ids chunkk unique ids
	 */
	public removeChunks (table: Table, ids: ChunkId[]) {
		const tablePool = this.#getAssertedTablePool(table)

		for (const chunk of tablePool.values()) {
			if (ids.includes(chunk.id)) {
				tablePool.delete(chunk)
			}
		}
	}

	/**
	 * Get all current table chunks
	 * 
	 * @param {Table} table table name
	 * @returns {Chunk[]} list of chunks
	 */
	public getChunks (table: Table): Chunk[] {
		const tablePool = this.#getAssertedTablePool(table)

		return [...tablePool.values()]
	}

	/**
	 * Get all current tables
	 * 
	 * @returns {Table[]}
	 */
	public getTables(): Table[] {
		return [...this.#chunks.keys()]
	}

	/**
	 * Get any unblocked chunk by now
	 * 
	 * @param {Table} table table name
	 * @returns {Chunk}
	 */
	public getUnblockedChunk(table: Table): Chunk {
		const tablePool = this.#getAssertedTablePool(table)

		let firstUnblockedChunk: Chunk | undefined

		for (const chunk of tablePool.values()) {
			if (chunk.isUnblocked()) {
				firstUnblockedChunk = chunk
				break
			}
		}

		if (!firstUnblockedChunk) {
			firstUnblockedChunk = new Chunk(table, this.getTtlMs())
			this.appendChunk(table, firstUnblockedChunk)
		}

		return firstUnblockedChunk
	}
}
