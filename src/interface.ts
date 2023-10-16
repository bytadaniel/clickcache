export type Table = string
export type InsertRow = Record<string, unknown>
export type ChunkId = string

export interface ResolverOptions {
	chunkLifeMs: number,
	chunkSize: number,
	checkIntervalMs: number,
	dataWatcher: 'disk' | 'process'
	disk?: {
		outputDirectory: string
	}
}