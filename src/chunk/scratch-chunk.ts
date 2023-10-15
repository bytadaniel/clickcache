import cuid from "cuid"
import { Table } from "../interface"
import { DataWatcher } from "../watchers/abstract"
import { Chunk } from "./chunk"

interface ScratchChunkData {
	table: Table
	liveAtLeastMs: number
}

export class ScratchChunk extends Chunk {
  constructor(dataWatcher: DataWatcher, scratchData: ScratchChunkData) {
    const currentTimestamp = Date.now()

    super(dataWatcher, {
      id: `${scratchData.table}_${currentTimestamp}_${cuid()}`,
      size: 0,
      table: scratchData.table,
      expiresAt: currentTimestamp + scratchData.liveAtLeastMs
    })
  }
}