import { ChunkId, Table } from "../interface";
import { Row } from "../row";

export interface StoreContract {
  chunkId: ChunkId,
  table: Table,
  rows: Row[]
}

export abstract class DataWatcher {
  public abstract store (storeContract: StoreContract): Promise<void>
  public abstract getRowCount(chunkId: ChunkId): Promise<number>
  public abstract getRowCountSync(chunkId: ChunkId): number
  public abstract restore(chunkId: ChunkId): Promise<StoreContract>
}