import cuid from 'cuid'
import { ChunkId, InsertRow } from './interface'

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
	table: string
	size: number
	#rows: InsertRow[]
	createdAt: number
	expiresAt: number
	blocked: boolean

	/**
	 * Create Chunk instance
	 * 
	 * @param {string} table 
	 * @param {number} liveAtLeastMs 
	 */
	constructor (
		table: string,
		liveAtLeastMs: number
	) {
		this.table = table
		this.#rows = []
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
	public isOverfilled (limit: number): boolean {
		return this.#rows.length >= limit
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
	 * @returns {InsertRow[]}
	 */
	public getRows (): InsertRow[] {
		return this.#rows
	}

	/**
	 * Add new rows to current chunk
	 * 
	 * @param {InsertRow[]} rows
	 */
	public appendRows (rows: InsertRow[]) {
		if (rows.length) {
			this.#rows.push(...rows)
			this.size += rows.length
		}
	}
}