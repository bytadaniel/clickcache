import { Chunk } from "./chunk";

export class ChunkFacade {
  readonly id: string;
  readonly expiresAt: number;
  readonly createdAt: number;
  readonly table: string;
  readonly size: number;

  constructor(protected readonly chunk: Chunk) {
    this.id = this.chunk.id
    this.table = this.chunk.table
    this.size = this.chunk.size
    this.expiresAt = this.chunk.expiresAt
    this.createdAt = this.chunk.createdAt
  }

  public async loadRows(): Promise<ReturnType<typeof this.chunk.loadRows>> {
    return this.chunk.loadRows()
  }
}