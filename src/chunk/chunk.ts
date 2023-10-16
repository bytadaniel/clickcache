import { ChunkId, Table } from "../interface"
import { Row } from "../row"
import { DataWatcher } from "../watchers/abstract"

interface ChunkData {
  id: ChunkId,
  size: number,
  table: Table,
  expiresAt: number
}

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
	consistent: boolean
	forceReady: boolean

  #dataWatcher: DataWatcher

	/**
	 * Create Chunk instance
	 * 
	 * @param {DataWatcher} dataWatcher
	 * @param {ChunkData} data
	 */
	constructor (
    dataWatcher: DataWatcher,
		data: ChunkData
	) {
    this.#dataWatcher = dataWatcher
		this.id = data.id
		this.size = data.size

		this.blocked = false
		this.consistent = true
		this.forceReady = false

		this.createdAt = Date.now()
		this.expiresAt = data.expiresAt

		this.table = data.table

	}

	public isExpired (): boolean {
		return Date.now() >= this.expiresAt
	}

	public isOverfilled (): boolean {
    return this.#dataWatcher.countRows(this.id) >= this.#dataWatcher.$options.chunkSize
	}

	public isConsistent () {
		return this.consistent
	}

	public isUnblocked (): boolean {
		return !this.blocked
	}

	public isReady (): boolean {
		return this.forceReady || this.isExpired() || this.isOverfilled()
	} 

	public block () {
		this.blocked = true
	}

	public unblock () {
		this.blocked = false
	}

	public setConsistency(state: boolean) {
		this.consistent = state
	}

	public setReady() {
		this.forceReady = true
	}

	public async loadRows (): Promise<Row[]> {
		return this.#dataWatcher
			.load(this.id)
			.then(load => load.loadedRows)
	}

	public async resolve() {
		await this.#dataWatcher.cleanup(this.id)
	}
}