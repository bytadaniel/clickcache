import { Chunk } from './chunk/chunk'
import { ChunkId, Table } from './interface'

interface ChunkState {
	chunkRef: Chunk,
	size: number,
	expiresAt: number
}

interface RegistryState {
	chunkTable: Record<string, string>,
	tableChunk: Record<string, string>,
	chunks: Record<ChunkId, ChunkState>
}

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
export class ChunkRegistry {
	#registry: RegistryState

	/**
	 * Create InMemoryPool instance
	 */
	constructor () {
		this.#registry = {
			tableChunk: {},
			chunkTable: {},
			chunks: {}
		}
	}

	public increaseSize (id: ChunkId, delta: number) {
		this.#registry.chunks[id].size += delta
		this.#registry.chunks[id].chunkRef.size += delta
	}

	public decreaseSize (id: ChunkId, delta: number) {
		this.#registry.chunks[id].size -= delta
		this.#registry.chunks[id].chunkRef.size -= delta
	}

	public register (chunk: Chunk) {
		this.#registry.chunkTable[chunk.id] = chunk.table
		this.#registry.tableChunk[chunk.table] = chunk.id

		this.#registry.chunks[chunk.id] = {
			chunkRef: chunk,
			expiresAt: chunk.expiresAt,
			size: chunk.size
		}
	}

	public unregister (id: ChunkId) {
		if (this.#registry.chunks[id]) {
			const table = this.#registry.chunkTable[id]

			delete this.#registry.tableChunk[table]
			delete this.#registry.chunkTable[id]
			delete this.#registry.chunks[id]
		}
	}

	public getOne (id: ChunkId): ChunkState {
		return this.#registry.chunks[id]
	}

	public getAll(): ChunkState[] {
		return Object.values(this.#registry.chunks)
	}

	public isEmpty(): boolean {
		return Object.keys(this.#registry.chunks).length === 0
	}

	public getTables(): Table[] {
		return Object.keys(this.#registry.tableChunk)
	}

	public getChunks(): ChunkId[] {
		return Object.keys(this.#registry.chunks)
	}
}
