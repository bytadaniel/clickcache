import { Chunk } from './сhunk'
import { Table, ChunkId } from './interface'

/**
 * Class representing a pool for row chunks
 * This pool abstraction let us to create any kind of strategies to insert chunks
 */
export abstract class ChunkPool {
	ttlMs: number
	maxSize: number

	constructor () {
		this.ttlMs = 1
		this.maxSize = 1
	}

	/**
	 * Setter
	 * time for chunk to be unblocked and alive for assumming new table rows
	 * 
	 * @param {number} ttlMs
	 */
	public setTtlMs (ttlMs: number) {
		this.ttlMs = ttlMs
	}

	/**
	 * Getter
	 * time for chunk to be unblocked and alive for assumming new table rows
	 * 
	 * @returns {number}
	 */
	public getTtlMs (): number {
		return this.ttlMs
	}

	/**
	 * Setter
	 * total count of rows can be collected in a single table chunk before being blocked and resolved
	 * 
	 * @param {number} maxSize
	 */
	public setMaxSize (maxSize: number) {
		this.maxSize = maxSize
	}

	/**
	 * Getter
	 * total count of rows can be collected in a single table chunk before being blocked and resolved
	 * 
	 * @returns {number}
	 */
	public getMaxSize (): number {
		return this.maxSize
	}


	/**
	 * Appending some chunk to a table chunk registry
	 * 
	 * @param {Table} table
	 * @param {Chunk} chunk
	 */
	abstract appendChunk (table: Table, chunk: Chunk): void

	/**
	 * Remove some single chunk from registry
	 * 
	 * @param {Table} table
	 * @param {ChunkId} id
	 */
	abstract removeChunk (table: Table, id: ChunkId): void

	/**
	 * Remove many chunks from registry
	 * 
	 * @param {Table} table
	 * @param {ChunkId[]} ids 
	 */
	abstract removeChunks (table: Table, ids: ChunkId[]): void

	/**
	 * Get table chunks as a snapshot
	 * 
	 * @param {Table} table
	 * @returns {Chunk[]}
	 */
	abstract getChunks (table: Table): Chunk[]
	
	/**
	 * Get list of tables which are represented in Pool registry
	 * 
	 * @returns {Table[]}
	 */
	abstract getTables (): Table[]

	/**
	 * Get already existing or new chunk
	 * 
	 * @param {Table} table
	 * 
	 * @returns {Chunk}
	 */
	abstract getUnblockedChunk (table: Table): Chunk
}
