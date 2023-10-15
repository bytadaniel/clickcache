# clickcache by @bytadaniel

<a href="https://www.npmjs.com/package/clickcache" alt="NPM latest version"><img src="https://img.shields.io/npm/v/clickcache.svg"></a>
<a href="https://www.npmjs.com/package/clickcache" alt="NPM total downloads"><img src="https://img.shields.io/npm/dt/clickcache.svg"></a>
<a href="https://github.com/bytadaniel/clickcache" alt="Github stars"><img src="https://img.shields.io/github/stars/bytadaniel/clickcache.svg?style=social&label=Star"></a>
<a href="https://github.com/bytadaniel/clickcache" alt="Github forks"><img src="https://img.shields.io/github/forks/bytadaniel/clickcache.svg?style=social&label=Fork"></a>
<a href="https://github.com/bytadaniel/clickcache" alt="Github contributors"><img src="https://img.shields.io/github/contributors/bytadaniel/clickcache.svg"></a>

![GitHub followers](https://img.shields.io/github/followers/bytadaniel?style=social)

## Why

In my data work, I encountered the need for a straightforward way to asynchronously gather small pieces of data into larger batches and efficiently transmit them to Clickhouse.
To address this requirement, I developed the `clickcache` package.

`сlickcache` excels at working not only with the [official clickhouse client](https://github.com/ClickHouse/clickhouse-js) but also with third-party clients.
It does so by delegating the read/write work to them while focusing on data aggregation in one central location and preparing it for insertion.

## Roadmap

This cache collector will support of is actually supporting caching data

- ✅ store data in the runtime process memory
- ✅ store data in the system memory storage (on your disk)
- 🏗 store data in the cloud (s3)

## Usage

```bash
npm install clickcache
```

```js
const config = {
  // choose the way to store data
  dataWatcher: 'process' // 'process' | 'disk'
  // set the time to live limit for batches
  ttlMs: 60_000,
  // set the max size limit for batches
  maxSize: 1_000,
  // set the check interval
  // it is normal to check batches state 5-10 times per TTL
  checkIntervalMs: 10_000
}

// define the singleton resolver instance
const resolver = new ChunkResolver(config)

// set as much handlers as you need

// sync handler to log chunk output
resolver.onResolved(chunk => {
  console.log(chunk.id)
  console.log(chunk.size)
})

// async handler to pass data in clickhouse storage
resolver.onResolved(async chunk => {
  const myRows = await chunk.loadRows()
  await clickhouseClient
    .insertFunction(myTable, myRows)
    .then(() => console.log('Hurrah! My data is saved!'))
    .catch(e => resolver.cache(myTable, myRows))
})

// use this method to cache a few rows or a single row
// it will be stored and collected to a huuuge batch of data
const chunk = await resolver.cache(myTable, rows)
```

# How it works

This package contains some enities

- `ChunkResolver`
- `ChunkRegistry`
- `DataWatcher`
- `Chunk`

It collects many single rows by uning `ChunkResolver`, then arranges these rows to chunks. When the chunk is ready, `ChunkResolver` passes it to your your handlers, where you are able to process database insertion

`Chunk` has a relation to `ChunkRegistry` and `DataWatcher`

`ChunkRegistry` is a in-memory storage shared within all parts of the core functionality. It contains chunk metadata such as chunk state (is blocked or not, is consistent or not, is expired or not etc) and chunk refs itself

`Chunk` has a relation with the stored data though `DataWatcher` and can `load` it according your need

`DataWatcher` is an abstract entity which interacts with the data. Data can be stored in `process memory`, `disk storage` and `cloud`. Data watcher can store and restore your data.

For example, you are using  the `disk storage` watcher. You are caching your data and someshing goes wrong with the main process. It restarts, restores the last state of data and concistently resolves it

It is not possible to restore the data by using `process memory` data watcher
