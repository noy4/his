#!/usr/bin/env -S node --import tsx
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { DatabaseSync } from 'node:sqlite'
import {
  discoverChromiumProfiles,
  discoverFirefoxProfiles,
  discoverSafariProfiles,
  open,
  parseChromiumStaging,
  parseFirefoxStaging,
  parseSafariStaging,
  parseTakeoutStaging,
  run,
  search,
  snapshot,
  takeoutProfileKey,
  type EpochMs,
  type RunResult,
  type SearchFilter,
  type SnapshotTarget,
  type SourceKind,
} from '../core/src/index.js'

// --- cli shape ---

const VERSION = '0.0.0'

const HELP = `his — browser history archive

Usage: his <command> [options]

  sync    [--source <kind>] [--full]
                                  run sync once (kinds: chromium firefox safari takeout)
  query   [text] [--url <url>] [--from <ms|date>] [--to <ms|date>] [--limit <n>]
                                  read-only search against history.db, prints JSON
  status                          print the running instance (url + archive)
  stop                            SIGTERM the running instance
  serve   [--port <n>] [--open]   start http + rpc (not implemented yet)

  --home <dir>                    archive home (env: HIS_HOME, default ~/.his)
  -h                              show help
  -v                              show version
`

interface Spec {
  type: 'string' | 'boolean'
  short?: string
}

const COMMON: Record<string, Spec> = {
  home: { type: 'string' },
  help: { short: 'h', type: 'boolean' },
  version: { short: 'v', type: 'boolean' },
}

const OPTIONS: Record<string, Record<string, Spec>> = {
  sync: { ...COMMON, source: { type: 'string' }, full: { type: 'boolean' } },
  query: { ...COMMON, url: { type: 'string' }, from: { type: 'string' }, to: { type: 'string' }, limit: { type: 'string' } },
  status: { ...COMMON },
  stop: { ...COMMON },
  serve: { ...COMMON, port: { type: 'string' }, open: { type: 'boolean' } },
}

type OptionValues = Record<string, string | boolean | (string | boolean)[] | undefined>

function str(values: OptionValues, key: string): string | undefined {
  const value = values[key]
  return typeof value === 'string' ? value : undefined
}

function resolveHome(homeArg: string | undefined): string {
  return homeArg ?? process.env.HIS_HOME ?? path.join(os.homedir(), '.his')
}

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

interface InstanceState {
  pid: number
  port: number
  url: string
  db: string
  token?: string
}

function stateFile(home: string): string {
  return path.join(home, 'state.json')
}

function readInstanceState(home: string): InstanceState | undefined {
  const file = stateFile(home)
  if (!fs.existsSync(file)) return undefined
  try {
    const state = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<InstanceState>
    if (typeof state.pid !== 'number' || typeof state.port !== 'number' || typeof state.url !== 'string' || typeof state.db !== 'string') {
      throw new Error('incomplete state')
    }
    return state as InstanceState
  } catch {
    fs.rmSync(file, { force: true })
    return undefined
  }
}

function parseTimeArg(raw: string): EpochMs | null {
  if (/^-?\d+$/.test(raw)) return Number(raw)
  const parsed = Date.parse(raw)
  return Number.isNaN(parsed) ? null : parsed
}

function parseLimitArg(raw: string): number | null {
  if (/^\d+$/.test(raw)) return Number(raw)
  return null
}

// --- sync ---

const SYNC_KINDS: SourceKind[] = ['chromium', 'firefox', 'safari', 'takeout']

function takeoutTargets(home: string): SnapshotTarget[] {
  const dir = path.join(home, 'takeout')
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => {
      const dbPath = path.join(dir, name)
      return { source: 'takeout' as const, profile: takeoutProfileKey(dbPath), displayName: `Takeout (${name})`, dbPath }
    })
}

function parseForKind(kind: SourceKind, snapshotPath: string) {
  switch (kind) {
    case 'chromium':
      return parseChromiumStaging(snapshotPath)
    case 'firefox':
      return parseFirefoxStaging(snapshotPath)
    case 'safari':
      return parseSafariStaging(snapshotPath)
    case 'takeout':
      return parseTakeoutStaging(snapshotPath)
  }
}

function kindLabel(target: SnapshotTarget): string {
  return `${target.source} · ${target.displayName ?? target.profile}`
}

function commandSync(homeArg: string | undefined, opts: { source?: string; full?: boolean }): number {
  const home = resolveHome(homeArg)
  const source = opts.source?.toLowerCase()
  if (source !== undefined && !SYNC_KINDS.includes(source as SourceKind)) {
    console.error(`unknown source: ${source} (kinds: ${SYNC_KINDS.join(' ')})`)
    return 1
  }
  const archive = open(path.join(home, 'history.db'))
  const kinds: SourceKind[] = source === undefined ? SYNC_KINDS : [source as SourceKind]
  let failures = 0
  for (const kind of kinds) {
    const targets = kind === 'chromium'
      ? discoverChromiumProfiles()
      : kind === 'firefox'
        ? discoverFirefoxProfiles()
        : kind === 'safari'
          ? discoverSafariProfiles()
          : takeoutTargets(home)
    for (const target of targets) {
      try {
        const snap = snapshot(target, home)
        const visits = parseForKind(kind, snap.path)
        const result: RunResult = run(
          archive,
          { kind: target.source as SourceKind, displayName: target.displayName ?? null, profilePath: target.dbPath },
          visits,
          { full: opts.full === true, now: Date.now() },
        )
        console.log(`${kindLabel(target)}: +${result.insertedVisits} visits · ${result.touchedUrls} urls${result.cleared ? ' (history cleared, offset realigned)' : ''}`)
      } catch (error) {
        failures += 1
        console.error(`${kindLabel(target)}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }
  archive.close()
  return failures === 0 ? 0 : 1
}

// --- query ---

function commandQuery(homeArg: string | undefined, opts: { text: string[]; url?: string; from?: string; to?: string; limit?: string }): number {
  const dbPath = path.join(resolveHome(homeArg), 'history.db')
  if (!fs.existsSync(dbPath)) {
    console.error(`no archive at ${dbPath} — run "his sync" first`)
    return 1
  }
  const filter: SearchFilter = {
    query: opts.text.length > 0 ? opts.text.join(' ') : undefined,
    url: opts.url,
  }
  if (opts.from !== undefined) {
    const from = parseTimeArg(opts.from)
    if (from === null) {
      console.error(`invalid --from: ${opts.from} (epoch ms or date)`)
      return 1
    }
    filter.from = from
  }
  if (opts.to !== undefined) {
    const to = parseTimeArg(opts.to)
    if (to === null) {
      console.error(`invalid --to: ${opts.to} (epoch ms or date)`)
      return 1
    }
    filter.to = to
  }
  if (opts.limit !== undefined) {
    const limit = parseLimitArg(opts.limit)
    if (limit === null) {
      console.error(`invalid --limit: ${opts.limit} (positive integer)`)
      return 1
    }
    filter.limit = limit
  }
  const db = new DatabaseSync(dbPath, { readOnly: true })
  try {
    const page = search(db, filter)
    console.log(JSON.stringify(page, null, 2))
  } finally {
    db.close()
  }
  return 0
}

// --- status / stop ---

function commandStatus(homeArg: string | undefined): number {
  const home = resolveHome(homeArg)
  const state = readInstanceState(home)
  if (state === undefined) return 1
  if (!processAlive(state.pid)) {
    fs.rmSync(stateFile(home), { force: true })
    return 1
  }
  console.log(JSON.stringify({ url: state.url, db: state.db, pid: state.pid }, null, 2))
  return 0
}

function commandStop(homeArg: string | undefined): number {
  const home = resolveHome(homeArg)
  const state = readInstanceState(home)
  if (state === undefined || !processAlive(state.pid)) {
    fs.rmSync(stateFile(home), { force: true })
    return 1
  }
  process.kill(state.pid, 'SIGTERM')
  fs.rmSync(stateFile(home), { force: true })
  console.log(`his: sent SIGTERM to pid ${state.pid}`)
  return 0
}

// --- main ---

function main(): number {
  const argv = process.argv.slice(2)
  const command = argv[0]
  if (command === undefined) {
    console.log(HELP)
    return 1
  }
  if (command === '-v' || command === '--version') {
    console.log(`his ${VERSION}`)
    return 0
  }
  if (command === '-h' || command === '--help') {
    console.log(HELP)
    return 0
  }
  const specs = OPTIONS[command]
  if (specs === undefined) {
    console.error(`unknown command: ${command}`)
    console.log(HELP)
    return 1
  }
  try {
    const { values, positionals } = parseArgs({
      args: argv.slice(1),
      options: specs,
      allowPositionals: true,
      strict: true,
    })
    if (values.version === true) {
      console.log(`his ${VERSION}`)
      return 0
    }
    if (values.help === true) {
      console.log(HELP)
      return 0
    }
    switch (command) {
      case 'sync':
        return commandSync(str(values, 'home'), { source: str(values, 'source'), full: values.full === true })
      case 'query':
        return commandQuery(str(values, 'home'), {
          text: positionals.filter((p): p is string => typeof p === 'string'),
          url: str(values, 'url'),
          from: str(values, 'from'),
          to: str(values, 'to'),
          limit: str(values, 'limit'),
        })
      case 'status':
        return commandStatus(str(values, 'home'))
      case 'stop':
        return commandStop(str(values, 'home'))
      case 'serve':
        console.error('serve is not implemented yet')
        return 1
    }
    return 1
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 1
  }
}

process.exitCode = main()
