import { DataWatcher, StoreContract } from "./abstract";
import { RowContract } from "../row";
import { EventEmitter } from "stream";
import { ChunkId } from "../interface";

enum Events {
  Block = 'block',
  Unblock = 'unblock'
}

export class ProcessWatcher extends DataWatcher {
  readonly #chunkStore: Record<ChunkId, RowContract[]>;
  #writeable: boolean;
  #emitter: EventEmitter;

  constructor () {
    super();
    this.#chunkStore = {}
    this.#writeable = true
    this.#emitter = new EventEmitter()

    this.#emitter.on(Events.Block, () => this.#writeable = false)
    this.#emitter.on(Events.Unblock, () => this.#writeable = true)
  }

  private async onUnblock() {
    return new Promise<void>((resolve) => this.#emitter.on(Events.Unblock, resolve))
  }

  public async getRowCount(chunkId: ChunkId): Promise<number> {
    return this.#chunkStore[chunkId]?.length ?? 0
  }

  public async store(storeContract: StoreContract): Promise<void> {
    if (!this.#chunkStore[storeContract.chunkId]) {
      this.#chunkStore[storeContract.chunkId] = []
    }

    !this.#writeable && await this.onUnblock()

    this.#chunkStore[storeContract.chunkId].push(...storeContract.rows.map(row => {
      return {
        chunkId: storeContract.chunkId,
        table: storeContract.table,
        row
      }
    }))
  }

  public async restore(chunkId: ChunkId): Promise<StoreContract> {
    this.#emitter.emit(Events.Block)

    let rows: RowContract[] = []

    if (this.#chunkStore[chunkId]) {
      rows = this.#chunkStore[chunkId]
    }

    this.#emitter.emit(Events.Unblock)

    return {
      chunkId,
      table: rows[0]?.table ?? 'not known',
      rows: rows.map(r => r.row)
    }
  }
}