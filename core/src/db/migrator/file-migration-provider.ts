import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Migration, MigrationEntry, MigrationProvider } from './migrator.ts'

export interface FileMigrationProviderProps {
  migrationFolder: string
}

// reads .sql / .ts migrations from a folder
export class FileMigrationProvider implements MigrationProvider {
  readonly #props: FileMigrationProviderProps

  constructor(props: FileMigrationProviderProps) {
    this.#props = props
  }

  async getMigrations(): Promise<MigrationEntry[]> {
    const migrations: MigrationEntry[] = []
    for (const fileName of await fs.readdir(this.#props.migrationFolder)) {
      const extension = path.extname(fileName)
      if (extension !== '.sql' && extension !== '.ts' && extension !== '.js') continue
      const name = fileName.slice(0, -extension.length)
      // filename order is apply order
      if (!/^\d+_/.test(name))
        throw new Error(`migration file must be named NNN_name: ${fileName}`)
      const filePath = path.join(this.#props.migrationFolder, fileName)
      if (extension === '.sql') {
        migrations.push({
          name,
          migration: sqlMigration(() => fs.readFile(filePath, 'utf8')),
        })
      } else {
        const module = (await import(pathToFileURL(filePath).href)) as { default?: unknown }
        const migration = module.default ?? module
        if (!isMigration(migration))
          throw new Error(`migration ${fileName} must export up(ctx)`)
        migrations.push({ name, migration })
      }
    }
    return migrations
  }
}

function sqlMigration(read: () => Promise<string>): Migration {
  return {
    async up(ctx) {
      ctx.handle.exec(await read())
    },
  }
}

function isMigration(value: unknown): value is Migration {
  return typeof value === 'object' && value !== null && typeof (value as { up?: unknown }).up === 'function'
}
