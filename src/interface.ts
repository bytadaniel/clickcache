export type Table = string
export type InsertRow = Record<string, unknown>
export type ChunkId = string

export interface ResolverOptions {
	ttlMs: number,
	maxSize: number,
	checkIntervalMs: number,
	dataWatcher: 'disk' | 'process'
	outputDirectory?: string
}