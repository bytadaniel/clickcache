import { Table, ChunkId } from "../interface";
import { Chunk } from "./chunk";
import { DataWatcher } from "../watchers/abstract";

interface ExistingChunkData {
	table: Table,
	id: ChunkId,
	expiresAt: number,
	size: number
}

export class ExistingChunk extends Chunk {
  constructor (dataWatcher: DataWatcher, existingData: ExistingChunkData) {
    super(dataWatcher, {
      id: existingData.id,
      size: existingData.size,
      table: existingData.table,
      expiresAt: existingData.expiresAt
    })
  }
}