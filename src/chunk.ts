import cuid from 'cuid'
import { ChunkId, Table } from './interface'
import { DataWatcher } from './watchers/abstract'
import { Row } from './row'

/**
 * Chunk of a nasic item of this package
 * 
 * Every chunk:
 * - has its unique id
 * - belongs to a table
 * - contain rows
 * - has size and time restrictions
 * - can be blocked/unblocked
 */
export class Chunk {
	id: ChunkId
	table: Table
	size: number
	createdAt: number
	expiresAt: number
	blocked: boolean
  #dataWatcher: DataWatcher

	/**
	 * Create Chunk instance
	 * 
	 * @param {string} table 
	 * @param {number} liveAtLeastMs 
	 */
	constructor (
    dataWatcher: DataWatcher,
		table: Table,
		liveAtLeastMs: number
	) {
		this.table = table
    this.#dataWatcher = dataWatcher
		this.blocked = false
		this.size = 0

		this.id = `${table}_${Date.now().toString()}_${cuid()}`
		this.createdAt = Date.now()
		this.expiresAt = this.createdAt + liveAtLeastMs
	}

	/**
	 * Get state current state of expiration
	 * 
	 * @returns {boolean}
	 */
	public isExpired (): boolean {
		return Date.now() >= this.expiresAt
	}

	/**
	 * Get state of overvilling provided size limit
	 * 
	 * @param {number} limit
	 * @returns {boolean}
	 */
	public async isOverfilled (limit: number): Promise<boolean> {
    return await this.#dataWatcher.getRowCount(this.id) >= limit
	}

	/**
	 * Get state of block
	 * 
	 * @returns {boolean}
	 */
	public isUnblocked (): boolean {
		return !this.blocked
	}

	/**
	 * Trigger current chunk to become blocked, i.e. do not allow new row insertions
	 */
	public block () {
		this.blocked = true
	}

	/**
	 * Trigger current chunk to become unblocked, i.e. allow new row insertions
	 * 
	 */
	public unblock () {
		this.blocked = false
	}

	/**
	 * Get current chunk rows
	 * 
	 * @returns {Row[]}
	 */
	public async getRows (): Promise<Row[]> {
		return this.#dataWatcher
			.restore(this.id)
			.then(storeContract => storeContract.rows)
	}

	/**
	 * Add new rows to current chunk
	 * 
	 * @param {Row[]} rows
	 */
	public async $appendRows (rows: Row[]) {
    await this.#dataWatcher.store({
      chunkId: this.id,
      table: this.table,
      rows
    })
	}
}