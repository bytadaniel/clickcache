import EventEmitter from "events";
import { ChunkId } from "../interface";
import { Row, RowContract } from "../row";
import { WatcherEvents } from "../constants";
import { Chunk } from "../chunk/chunk";

export interface LoadContract {
  // chunkRef: Chunk,
  loadedRows: Row[]
}

export interface SaveContract {
  chunkRef: Chunk
  insertRows: Row[]
}

export abstract class DataWatcher<SC extends SaveContract = SaveContract, LC extends LoadContract = LoadContract> {
  // readonly $externalStore: Record<ChunkId, LoadContract>;
  // readonly $memoryStore: Record<ChunkId, LoadContract & { rows: RowContract[] }>
  $emitter: EventEmitter;
  #writeable: boolean;

  constructor() {
    this.$emitter = new EventEmitter()
    this.#writeable = true

    this.$emitter.on(WatcherEvents.Block, () => this.$setWriteable(false))
    this.$emitter.on(WatcherEvents.Unblock, () => this.$setWriteable(true))
  }

  public $setWriteable (state: boolean) {
    this.#writeable = state
  }

  public $isWriteable (): boolean {
    return this.#writeable
  }

  public async $toBeUnblocked() {
    return new Promise<void>((resolve) => this.$emitter.on(WatcherEvents.Unblock, resolve))
  }

  public abstract save (storeContract: SC): Promise<void>
  public abstract load(chunkId: ChunkId): Promise<LC>
  public abstract restore(): Promise<void>
  public abstract cleanup(chunkId: ChunkId): Promise<void>

  public abstract countRows(chunkId: ChunkId): number
}