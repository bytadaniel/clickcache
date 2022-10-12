import { Chunk } from '../src/сhunk'
import { ChunkResolver } from '../src/chunk-resolver'
import { ResolverOptions } from '../src/interface'
import { InMemoryPool } from '../src/pools'

function createResolver (options: ResolverOptions) {
	return new ChunkResolver(new InMemoryPool(), options)
}

function wait(ms: number) {
	return new Promise<void>((resolve) => setTimeout(resolve, ms))
}


describe('Testing main functionality', () => {
	it('should send resolve callback', async () => {
		const ttlMs = 20
		const maxSize = 1
		const checkIntervalMs = 10
		const resolver = createResolver({ ttlMs, maxSize, checkIntervalMs })

		const chunks: Chunk[] = []
		resolver.onResolved(chunk => void chunks.push(chunk))
		resolver.cache('table', [{ key: 'value' }])

		await wait(ttlMs*2)
		resolver.stop()

		expect(chunks.length).toBeGreaterThan(0)
	})

	it('should resolve all rows', async () => {
		const ttlMs = 100
		const maxSize = 100
		const checkIntervalMs = 25
		const resolver = createResolver({ ttlMs, maxSize, checkIntervalMs })

		const chunks: Chunk[] = []
		resolver.onResolved(chunk => void chunks.push(chunk))

		const rows = new Array(maxSize).fill(null).map((_, id) => ({ id }))
		resolver.cache('table', rows)

		await wait(ttlMs*2)
		resolver.stop()

		expect(chunks.length).toBeGreaterThan(0)
		expect(chunks[0]?.getRows().length).toEqual(maxSize)

	})

	it('should resolve by ttlMs', async () => {
		const ttlMs = 100
		const maxSize = 100
		const checkIntervalMs = 10
		const resolver = createResolver({ ttlMs, maxSize, checkIntervalMs })

		const chunks: Chunk[] = []
		resolver.onResolved(chunk => void chunks.push(chunk))

		const rows = new Array(maxSize - 1).fill(null).map((_, id) => ({ id }))
		resolver.cache('table', rows)

		await wait(ttlMs*2)
		resolver.stop()

		expect(chunks.length).toBeGreaterThan(0)
		expect(chunks[0]?.isExpired()).toEqual(true)
		expect(chunks[0]?.isOverfilled(maxSize)).toEqual(false)
		expect(chunks[0]?.getRows().length).toBeLessThan(maxSize)
	})

	it('should resolve by maxSize', async () => {
		const ttlMs = 500
		const maxSize = 100
		const checkIntervalMs = 200
		const resolver = createResolver({ ttlMs, maxSize, checkIntervalMs })

		const chunks: Chunk[] = []
		resolver.onResolved(chunk => void chunks.push(chunk))

		const rows = new Array(maxSize).fill(null).map((_, id) => ({ id }))
		resolver.cache('table', rows)

		await wait(ttlMs*2)
		resolver.stop()

		expect(chunks.length).toBeGreaterThan(0)
		expect(chunks[0]?.isOverfilled(maxSize)).toEqual(true)
		expect(chunks[0]?.getRows().length).toEqual(maxSize)
	})

	it('should create new chunk', async () => {
		const ttlMs = 500
		const maxSize = 100
		const checkIntervalMs = 250
		const resolver = createResolver({ ttlMs, maxSize, checkIntervalMs })

		const chunks: Chunk[] = []
		resolver.onResolved(chunk => void chunks.push(chunk))

		const rows = new Array(maxSize).fill(null).map((_, id) => ({ id }))
		resolver.cache('table', rows)
		resolver.cache('table', rows)
		resolver.cache('table', rows)
		resolver.cache('table', rows)

		await wait(ttlMs*2)
		resolver.stop()
		
		expect(chunks.length).toEqual(4)
	})

	it('should collect rows into a single chunk', async () => {
		const ttlMs = 500
		const maxSize = 100
		const checkIntervalMs = 100
		const resolver = createResolver({ ttlMs, maxSize, checkIntervalMs })

		const chunks: Chunk[] = []
		resolver.onResolved(chunk => void chunks.push(chunk))

		const rows = new Array(maxSize/4).fill(null).map((_, id) => ({ id }))
		resolver.cache('table', rows)
		resolver.cache('table', rows)
		resolver.cache('table', rows)
		resolver.cache('table', rows)

		await wait(ttlMs*2)
		resolver.stop()
		
		expect(chunks.length).toEqual(1)
		expect(chunks[0].getRows().length).toEqual(maxSize)
	})
})