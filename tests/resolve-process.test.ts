import { Chunk } from '../src/chunk/chunk'
import { ChunkResolver } from '../src/chunk-resolver'
import { ResolverOptions } from '../src/interface'
import { sleep } from '../src/utils'
import { ChunkFacade } from '../src/chunk/chunk-facade'

function createResolver(): ChunkResolver {
  return new ChunkResolver({
    dataWatcher: 'process',
    ttlMs: 500,
    maxSize: 500,
    checkIntervalMs: 100
  })
}

function createRows(count: number) {
  return new Array(count).fill({
    int: 1,
    fload: 5.55,
    boolean: false,
    string: 'string',
    map: {
      mapInt: 1,
      mapString: 'string'
    }
  })
}

describe('Test process resolver', () => {
  it('should not lose rows', async () => {
    const rowCount = 500
    const resolver = createResolver()

    resolver.cache('table', createRows(rowCount))

    let chunkSize = 0
    let chunkRowsLength = 0

    await new Promise<void>((resolve) => {
      resolver.onResolved(async (chunk) => {
        chunkSize = chunk.size
        chunkRowsLength = (await chunk.loadRows()).length
        resolve()
      })
    })
    await sleep(3000)

    expect(chunkSize).toBe(rowCount)
    expect(chunkRowsLength).toBe(rowCount)
  })
})
