import { ChunkResolver } from '../src/chunk-resolver'
import { sleep } from '../src/utils'

function createResolver(): ChunkResolver {
  return new ChunkResolver({
    chunkLifeMs: 5000,
    chunkSize: 500,
    checkIntervalMs: 1000,
    dataWatcher: 'disk',
    disk: {
      outputDirectory: './chunks',
    }
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

// afterAll(() => {
//   fs.unlinkSync('./chunks')
// })

describe('Test disk resolver', () => {
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
