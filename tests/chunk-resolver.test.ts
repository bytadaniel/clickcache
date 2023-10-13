import { Chunk } from "../src/chunk";
import { ChunkResolver } from "../src/chunk-resolver";
import { sleep } from "../src/utils";
import { ProcessWatcher } from "../src/watchers/process.watcher";

describe('ChunkResolver', () => {
  let chunkResolver: ChunkResolver;
  const ttlMs = 100
  const maxSize = 100
  const checkIntervalMs = 10

  beforeEach(() => {
    // Mock dependencies and initialize the ChunkResolver instance
    chunkResolver = new ChunkResolver(new ProcessWatcher(), { ttlMs, maxSize, checkIntervalMs });
  });

  afterEach(() => {
    // Clean up any resources used by the ChunkResolver instance
    chunkResolver.stop()
  });

  test('onResolved invokes the provided callback when a chunk is resolved', async () => {
    const resolvedChunks: Chunk[] = [];

    // Register the callback function with onResolved
    chunkResolver.onResolved((chunk) => resolvedChunks.push(chunk));

    const rows = new Array(100).fill(null).map((_, id) => ({ id }))
    
    await chunkResolver.cache('table1', rows);

    await new Promise((resolve) => setTimeout(resolve, ttlMs));

    expect(resolvedChunks[0].size).toEqual(rows.length);
  });

  test('onAsyncResolved invokes the provided callback asynchronously for each resolved chunk', async () => {
    const resolvedChunks: Chunk[] = [];

    // Register the callback function with onAsyncResolved
    chunkResolver.onAsyncResolved(async (chunk) => {
      // Simulate an asynchronous operation
      await sleep(ttlMs)
      resolvedChunks.push(chunk);
    });

    await chunkResolver.cache('table1', [{}, {}, {}]);

    // Wait for the asynchronous operations to complete
    await sleep(ttlMs*5)

    expect(resolvedChunks[0].size).toEqual(3);
  });
});
