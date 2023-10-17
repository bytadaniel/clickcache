import fs from 'fs'
import path from 'path'
import { DataWatcher, SaveContract, LoadContract, DataWatcherOptions } from "./abstract";
import { promisify } from 'util';
import { ExistingChunk } from '../chunk/existing-chunk';
import { ChunkRegistry } from '../chunk-registry';
import { Chunk } from '../chunk/chunk';
import { ChunkId, Table } from '../interface';
import { Row } from '../row';
import cuid from 'cuid';
import { CacheError } from '../errors';
import { E_CODES } from '../constants';

export interface FsWatcherOptions extends DataWatcherOptions {
  disk: {
    outputDirectory: string
  }
}

interface DiskLoadContract extends LoadContract {
  chunkRef: Chunk
}

interface ChunkMetadata {
  table: string
  expiresAt: number
}

const fsExistsAsync = promisify(fs.exists)
const fsMkdirAsync = promisify(fs.mkdir)
const fsReadFileAsync = promisify(fs.readFile)
const fsWriteFileAsync = promisify(fs.writeFile)
const fsAppendFileAsync = promisify(fs.appendFile)
const fsUnlinkAsync = promisify(fs.unlink)
const fsReaddirAsync = promisify(fs.readdir)

type OperationId = string

export class DiskWatcher extends DataWatcher<SaveContract, DiskLoadContract, FsWatcherOptions> {
  readonly #registry: ChunkRegistry;
  readonly #options: FsWatcherOptions;
  readonly #chunks: Record<ChunkId, {
    ref: Chunk,
    operations: Record<OperationId, Row[]>
  }>
  
  constructor(registry: ChunkRegistry, options: FsWatcherOptions) {
    super(options)

    this.#registry = registry
    this.#options = options

    /**
     * Runtime cache storage
     */
    this.#chunks = {}
  }

  public async save(saveContract: SaveContract): Promise<void> {
    if (!saveContract.insertRows.length) {
      throw new CacheError(E_CODES.E_EMPTY_SAVE)
      return
    }

    if (!this.$isWriteable()) {
      await this.$toBeUnblocked()
    }

    const operationId = cuid()

    saveContract.chunkRef.setConsistency(false)
    if (!this.#chunks[saveContract.chunkRef.id]) {
      this.#chunks[saveContract.chunkRef.id] = {
        ref: saveContract.chunkRef,
        operations: {}
      }
    }
    this.#chunks[saveContract.chunkRef.id].operations[operationId] = saveContract.insertRows

    const chunkDirectoryExists = await fsExistsAsync(this.#options.disk.outputDirectory)
    if (!chunkDirectoryExists) {
      await fsMkdirAsync(this.#options.disk.outputDirectory)
    }

    const chunkFilename = `${saveContract.chunkRef.id}.txt`
    const chunkPathname = path.resolve(this.#options.disk.outputDirectory, chunkFilename)

    const chunkExists = await fsExistsAsync(chunkPathname)
    if (!chunkExists) {
      const metadata = {
        table: saveContract.chunkRef.table,
        expiresAt: saveContract.chunkRef.expiresAt
      }
      await fsWriteFileAsync(chunkPathname, `${JSON.stringify(metadata)}\n`)
    }

    /**
     * Need some kind of schema to optimize
     */
    const storeData = saveContract.insertRows
      .map(row => JSON.stringify(row))
      .join('\n')
      .concat('\n')

    await fsAppendFileAsync(chunkPathname, storeData)
      .then(() => {
        this.#registry.increaseSize(
          saveContract.chunkRef.id,
          saveContract.insertRows.length
        )
        saveContract.chunkRef.setConsistency(true)
        delete this.#chunks[saveContract.chunkRef.id].operations[operationId]
      })

  }

  public async load(chunkId: string): Promise<DiskLoadContract> {
    const chunkFilename = `${chunkId}.txt`
    const chunkPathname = path.resolve(this.#options.disk.outputDirectory, chunkFilename)

    const data = await fsReadFileAsync(chunkPathname, { encoding: 'utf8' })

    const [strMetadata, ...strRows] = data.trim().split('\n')

    const metadata: ChunkMetadata = JSON.parse(strMetadata)
    const rows: Record<string, unknown>[] = strRows.map(strRow => JSON.parse(strRow))

    return {
      chunkRef: new ExistingChunk(this, {
        id: chunkId,
        table: metadata.table,
        expiresAt: metadata.expiresAt,
        size: rows.length
      }),
      loadedRows: rows
    }
  }

  public backupRuntimeCache(): void {
    for (const chunkId in this.#chunks) {
      const chunkDirectoryExists = fs.existsSync(this.#options.disk.outputDirectory)
      if (!chunkDirectoryExists) {
        fs.mkdirSync(this.#options.disk.outputDirectory)
      }

      const chunkFilename = `${chunkId}.txt`
      const chunkPathname = path.resolve(this.#options.disk.outputDirectory, chunkFilename)

      const chunk = this.#chunks[chunkId].ref

      const chunkExists = fs.existsSync(chunkPathname)
      if (!chunkExists) {
        const metadata = {
          table: chunk.table,
          expiresAt: chunk.expiresAt
        }
        fs.writeFileSync(chunkPathname, `${JSON.stringify(metadata)}\n`)
      }

      for (const operationId in this.#chunks[chunkId].operations) {
        const runtimeRows = this.#chunks[chunkId].operations[operationId]

        /**
         * Need some kind of schema to optimize
         */
        const storeData = runtimeRows
          .map(row => JSON.stringify(row))
          .join('\n')
          .concat('\n')

        fs.appendFileSync(chunkPathname, storeData)

        chunk.setConsistency(true)
        delete this.#chunks[chunkId].operations[operationId]

        console.log(`Succesfully backed up operation ${operationId} of chunk ${chunkId} with ${runtimeRows.length} rows`)
      }
    }
  }

  public async restore(): Promise<void> {
    const chunkDirectoryExists = await fsExistsAsync(this.#options.disk.outputDirectory)
    if (!chunkDirectoryExists) {
      return
    }

    const files = await fsReaddirAsync(this.#options.disk.outputDirectory)

    for (const filename of files) {
      const isChunkFile = filename.includes('.txt')
      if (!isChunkFile) {
        continue
      }

      const chunkId = filename.split('.txt').join('')

      const loaded = await this.load(chunkId)

      this.#registry.register(loaded.chunkRef)
    }
  }

  public async cleanup(chunkId: string): Promise<void> {
    const chunkFilename = `${chunkId}.txt`
    const chunkPathname = path.resolve(this.#options.disk.outputDirectory, chunkFilename)

    await fsUnlinkAsync(chunkPathname)
  }

  public countRows(chunkId: string): number {
    return this.#registry.getOne(chunkId).size
  }
}