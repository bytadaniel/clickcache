import { Chunk } from "./src/chunk";
import { ChunkResolver } from "./src/chunk-resolver";
import { ProcessWatcher } from "./src/watchers/process.watcher";

(async function () {
  const ttlMs = 100
  const maxSize = 100
  const checkIntervalMs = 10
  const chunkResolver = new ChunkResolver(new ProcessWatcher(), { ttlMs, maxSize, checkIntervalMs });
  
  const resolvedChunks: Chunk[] = [];
  
  // Register the callback function with onAsyncResolved
  chunkResolver.onAsyncResolved(async (chunk) => {
    // Simulate an asynchronous operation
    await new Promise((resolve) => setTimeout(resolve, 100));
    resolvedChunks.push(chunk);
  });
  
  await chunkResolver.cache('table1', [{}, {}, {}]);
  
  // Wait for the asynchronous operations to complete
  await new Promise((resolve) => setTimeout(resolve, 200));

  console.log(resolvedChunks)
})()
