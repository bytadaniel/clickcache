# clickcache by @bytadaniel

[![Join the chat at https://gitter.im/bytadaniel/clickcache](https://badges.gitter.im/bytadaniel/clickcache.svg)](https://gitter.im/bytadaniel/clickcache?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

![Travis (.org)](https://img.shields.io/travis/bytadaniel/chcache)
![Libraries.io dependency status for GitHub repo](https://img.shields.io/librariesio/github/bytadaniel/chcache)
![npms.io (final)](https://img.shields.io/npms-io/final-score/chcache)
![GitHub issues](https://img.shields.io/github/issues/bytadaniel/chcache)

![Gitter](https://img.shields.io/gitter/room/bytadaniel/clickcache)

![GitHub followers](https://img.shields.io/github/followers/bytadaniel?style=social)


## Why
Hello! Some time ago I faced the problem of lack of quality Clickhouse software for Node.js
Unfortunately, most of the clients contain a lot of bugs and are not supported. What frustrated me even more is that there are no packages for native batch insertion.
For this reason, I decided to write this package - a universal batch insert engine specifically for Clickhouse!

## Roadmap
This module was tested in production for about a year being a part of [clickhouse-ts](https://www.npmjs.com/package/clickhouse-ts) package, my Clickhouse client.
In order to clean up the code, I decided to separate theis caching module into its own repository.
This cache collector will support of is actually supporting caching data
- ✅ in the process memory
- 🏗 on the hard disk
- 🏗 in RAM
- 🏗 in S3 Object Storage

## Usage
```js
const config = {
  ttlMs: 60_000,
  maxSize: 1_000,
  checkIntervalMs: 10_000
}

const resolver = new ChunkResolver(new InMemoryPool(), config)

resolver.onResolved(chunk => {
  handleInsertion(chunk.table, chunk.getRows())
})

onGracefulStutdown(() => resolver.resolveImmediately())

const chunk = resolver.cache('table', rows)

chunk.isOverfilled() // boolean
chunk.isExpired() // boolean
chunk.isUnblocked() // boolean
chunk.block()
chunk.unblock()
chunk.size // length
chunk.createdAt // unix
chunk.expiresAt // unix
```
