import { DataWatcher, SaveContract, LoadContract } from "./abstract";
import { RowContract } from "../row";
import { ChunkId } from "../interface";
import { ChunkRegistry } from "../chunk-registry";

export class ProcessWatcher extends DataWatcher {
  readonly #registry: ChunkRegistry;
  readonly #chunkRows: Record<ChunkId, RowContract[]>

  constructor (registry: ChunkRegistry) {
    super();

    this.#chunkRows = {}
    this.#registry = registry
  }

  public async save(saveContract: SaveContract): Promise<void> {
    if (!this.#registry.getOne(saveContract.chunkRef.id)) {
      this.#registry.register(saveContract.chunkRef)
    }

    if (!this.$isWriteable()) {
      await this.$toBeUnblocked()
    }

    if (!this.#chunkRows[saveContract.chunkRef.id]) {
      this.#chunkRows[saveContract.chunkRef.id] = []
    }

    this.#chunkRows[saveContract.chunkRef.id].push(
      ...saveContract.insertRows.map(row => {
        return {
          chunkId: saveContract.chunkRef.id,
          table: saveContract.chunkRef.table,
          row
        }
      })
    )

    this.#registry.increaseSize(saveContract.chunkRef.id, saveContract.insertRows.length)
  }

  public async load(chunkId: ChunkId): Promise<LoadContract> {
    const loadedRows = this.#chunkRows[chunkId] ?? {}

    return {
      loadedRows
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  public async cleanup(): Promise<void> {}

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  public async restore() {}

  public countRows(chunkId: ChunkId): number {
    return this.#registry.getOne(chunkId).size
  }
}