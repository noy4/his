import dayjs from 'dayjs'

// Frontend-only demo data for the Keywords view (no server / RPC yet).

export interface KeywordEvent {
  id: number
  term: string
  engine: string
  url: string
  time: number
}

export interface KeywordStats {
  totals: {
    searches: number
    keywords: number
    firstVisit: number
    lastVisit: number
  }
  byDay: { day: string; visits: number }[]
}

const ENGINES = ['google', 'bing', 'duckduckgo', 'brave']

const TERMS = [
  'typescript generics', 'react server components', 'sqlite fts5 trigram', 'dayjs format',
  'electron ipc', 'css container queries', 'preact signals', 'tailwind v4',
  'kysely migrations', 'node sqlite', 'vite plugin', 'recharts bar chart',
  'web components', 'http caching', 'oauth pkce', 'jwt expiry',
  'rust ownership', 'go generics', 'python asyncio', 'docker compose',
  'kubernetes ingress', 'postgres index', 'redis streams', 'graphql federation',
  'openai embeddings', 'vector database', 'llm tokenizer', 'prompt caching',
  'css grid', 'es modules', 'webassembly', 'regex lookbehind',
  'git rebase', 'macos codesign', 'ffmpeg filter', 'wasm simd',
]

export function engineUrl(engine: string, term: string): string {
  const q = encodeURIComponent(term)
  switch (engine) {
    case 'bing': return `https://www.bing.com/search?q=${q}`
    case 'duckduckgo': return `https://duckduckgo.com/?q=${q}`
    case 'brave': return `https://search.brave.com/search?q=${q}`
    default: return `https://www.google.com/search?q=${q}`
  }
}

// deterministic PRNG so the demo data is stable across reloads
function rng(seed: number): () => number {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

const DAYS = 180

function buildEvents(): KeywordEvent[] {
  const events: KeywordEvent[] = []
  const today = dayjs().startOf('day')
  let id = 0
  for (let d = DAYS - 1; d >= 0; d -= 1) {
    const day = today.subtract(d, 'day')
    const rand = rng(day.valueOf() & 0x7fffffff)
    const n = Math.floor(rand() * 6) + (d < 20 ? 2 : 0)
    for (let i = 0; i < n; i += 1) {
      const term = TERMS[Math.floor(rand() * TERMS.length)]
      const engine = ENGINES[Math.floor(rand() * ENGINES.length)]
      const time = day
        .add(Math.floor(rand() * 24), 'hour')
        .add(Math.floor(rand() * 60), 'minute')
        .valueOf()
      id += 1
      events.push({ id, term, engine, url: engineUrl(engine, term), time })
    }
  }
  return events.sort((a, b) => b.time - a.time)
}

const EVENTS = buildEvents()

function inMonth(time: number, month?: string): boolean {
  return month === undefined || dayjs(time).format('YYYY-MM') === month
}

export function dummyKeywordStats(month?: string): KeywordStats {
  const scoped = EVENTS.filter((e) => inMonth(e.time, month))
  const terms = new Set<string>()
  const byDay = new Map<string, number>()
  let firstVisit = Number.POSITIVE_INFINITY
  let lastVisit = 0

  for (const e of scoped) {
    firstVisit = Math.min(firstVisit, e.time)
    lastVisit = Math.max(lastVisit, e.time)
    const day = dayjs(e.time).format('YYYY-MM-DD')
    byDay.set(day, (byDay.get(day) ?? 0) + 1)

    terms.add(e.term.toLowerCase())
  }

  return {
    totals: {
      searches: scoped.length,
      keywords: terms.size,
      firstVisit: Number.isFinite(firstVisit) ? firstVisit : 0,
      lastVisit,
    },
    byDay: [...byDay.entries()]
      .map(([day, visits]) => ({ day, visits }))
      .sort((a, b) => a.day.localeCompare(b.day)),
  }
}

export function dummyRecentKeywords(
  month?: string,
  offset = 0,
  limit = 30,
): { items: KeywordEvent[]; nextOffset: number | null } {
  const scoped = EVENTS.filter((e) => inMonth(e.time, month))
  const items = scoped.slice(offset, offset + limit)
  const next = offset + limit
  return { items, nextOffset: next < scoped.length ? next : null }
}
