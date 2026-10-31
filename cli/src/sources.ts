import { historyDbPath, initDb, settings, sourceKey, sources } from '@his/core/node'
import type { KyselyDb, SourceEntry } from '@his/core/node'
import type { Context } from './context.ts'

export async function sourcesCommand(ctx: Context, args: string[]): Promise<void> {
  const [action, ...tokens] = args
  const db = await initDb(historyDbPath(ctx.home))
  try {
    switch (action) {
      case undefined:
      case 'list':
        await list(ctx, db)
        return
      case 'add':
        await add(db, tokens)
        return
      case 'remove':
        await remove(db, tokens)
        return
      default:
        throw new Error(`unknown sources command: ${action} (list, add, remove)`)
    }
  } finally {
    await db.destroy()
  }
}

async function list(ctx: Context, db: KyselyDb): Promise<void> {
  const [entries, info] = await Promise.all([
    sources.list(db, { home: ctx.home }),
    settings.get(db),
  ])
  const enabled = new Set(info.sync_targets ?? [])
  if (entries.length === 0) {
    console.log('no sources found')
    return
  }
  const width = Math.max(...entries.map((entry) => sourceKey(entry).length))
  for (const entry of entries)
    console.log(formatEntry(entry, enabled, width))
}

function formatEntry(entry: SourceEntry, enabled: Set<string>, width: number): string {
  const marker = enabled.has(entry.browser) || enabled.has(sourceKey(entry)) ? '*' : ' '
  const detail = entry.registered ? `${entry.visits} visits` : 'unregistered'
  return `${marker} ${sourceKey(entry).padEnd(width)}  ${detail}`
}

async function add(db: KyselyDb, tokens: string[]): Promise<void> {
  if (tokens.length === 0) throw new Error('add needs at least one target (browser or browser:profile)')
  const current = await currentTargets(db)
  const next = [...current, ...tokens.filter((token) => !current.includes(token))]
  await save(db, next)
}

async function remove(db: KyselyDb, tokens: string[]): Promise<void> {
  if (tokens.length === 0) throw new Error('remove needs at least one target (browser or browser:profile)')
  const current = await currentTargets(db)
  const next = current.filter((token) => !tokens.includes(token))
  await save(db, next)
}

async function currentTargets(db: KyselyDb): Promise<string[]> {
  return (await settings.get(db)).sync_targets ?? []
}

async function save(db: KyselyDb, tokens: string[]): Promise<void> {
  const info = await settings.set(db, { sync_targets: tokens })
  const stored = info.sync_targets ?? []
  console.log(stored.length === 0 ? 'sync targets: (none)' : `sync targets: ${stored.join(' ')}`)
}
