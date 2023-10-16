import fs from 'fs'
import path from 'path'
import { DataWatcher, SaveContract, LoadContract, DataWatcherOptions } from "./abstract";
import { promisify } from 'util';
import { ExistingChunk } from '../chunk/existing-chunk';
import { ChunkRegistry } from '../chunk-registry';
import { Chunk } from '../chunk/chunk';

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

export class DiskWatcher extends DataWatcher<SaveContract, DiskLoadContract, FsWatcherOptions> {
  readonly #registry: ChunkRegistry;
  readonly #options: FsWatcherOptions;
  
  constructor(registry: ChunkRegistry, options: FsWatcherOptions) {
    super(options)

    this.#registry = registry
    this.#options = options
  }

  public async save(saveContract: SaveContract): Promise<void> {
    if (!this.$isWriteable()) {
      await this.$toBeUnblocked()
    }

    saveContract.chunkRef.setConsistency(false)

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
      .then(() => this.#registry.increaseSize(
        saveContract.chunkRef.id,
        saveContract.insertRows.length
      ))

    saveContract.chunkRef.setConsistency(true)
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