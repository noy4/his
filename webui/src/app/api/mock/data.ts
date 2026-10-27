import type { HistoryItem, SourceProfile, Transition, VisitItem } from '../types'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

type Rand = () => number

function mulberry32(seed: number): Rand {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(r: Rand, xs: readonly T[]): T {
  return xs[Math.floor(r() * xs.length)]
}

function int(r: Rand, lo: number, hi: number): number {
  return lo + Math.floor(r() * (hi - lo + 1))
}

function kebab(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function base62(r: Rand, n: number): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let s = ''
  for (let i = 0; i < n; i++) s += chars[Math.floor(r() * chars.length)]
  return s
}

function hex(r: Rand, n: number): string {
  let s = ''
  for (let i = 0; i < n; i++) s += '0123456789abcdef'[Math.floor(r() * 16)]
  return s
}

const TOPICS = [
  'React Compiler', 'Preact Signals', 'keyset pagination', 'trigram search',
  'WebSocket reconnection', 'JSON-RPC over WS', 'SQLite WAL mode', 'IntersectionObserver',
  'debounced search', 'Vite Rolldown', 'oxlint type-aware', 'TypeScript union narrowing',
  'generic constraints', 'bundler module resolution', 'soft delete pattern', 'undo toast',
  'favicon eTLD+1', 'git worktree', 'gh CLI scripting', 'semantic versioning',
  'dark mode contrast', 'Geist font pairing', 'tabular numerals', 'Intl date formatting',
  'timezone pitfalls', 'SQLite FTS5', 'query planner', 'EXPLAIN ANALYZE',
  'database migrations', 'idempotency keys', 'service worker caching', 'IndexedDB limits',
]

const REPO_PAIRS = [
  ['facebook', 'react'], ['vitejs', 'vite'], ['preactjs', 'signals'],
  ['microsoft', 'TypeScript'], ['oven-sh', 'bun'], ['evanw', 'esbuild'],
] as const

const USERS = ['noy', 'hiro', 'anna', 'kenji', 'sana']
const YT_CHANNELS = ['Fireship', 'Theo - t3.gg', 'Web Dev Simplified', 'ByteByteGo', 'Hussein Nasser', 'freeCodeCamp.org']
const SUBREDDITS = ['typescript', 'reactjs', 'webdev', 'sqlite', 'commandline']
const MDN_APIS = ['IntersectionObserver', 'WebSocket', 'crypto.randomUUID', 'structuredClone', 'Intl.DateTimeFormat']

const TRANSITION_POOL: readonly Transition[] = [
  'link', 'link', 'link', 'link', 'link', 'link', 'link',
  'typed', 'typed', 'reload', 'auto_subframe', 'auto_bookmark', 'form_submit', 'generated',
]

interface Site {
  domain: string
  make: (r: Rand, topic: string, slug: string) => { path: string; title: string }
}

const SITES: Site[] = [
  {
    domain: 'github.com',
    make: (r, topic) => {
      const [owner, repo] = pick(r, REPO_PAIRS)
      const n = int(r, 100, 9000)
      const user = pick(r, USERS)
      if (r() < 0.4) return { path: `/${owner}/${repo}`, title: `${owner}/${repo}: ${topic} · GitHub` }
      if (r() < 0.5) return { path: `/${owner}/${repo}/pull/${n}`, title: `${topic} by ${user} · Pull Request #${n} · ${owner}/${repo}` }
      return { path: `/${owner}/${repo}/issues/${n}`, title: `${topic} · Issue #${n} · ${owner}/${repo}` }
    },
  },
  {
    domain: 'stackoverflow.com',
    make: (r, topic, slug) => ({
      path: `/questions/${int(r, 1000, 9999999)}/${slug}`,
      title: `${topic} - Stack Overflow`,
    }),
  },
  {
    domain: 'developer.mozilla.org',
    make: (r) => {
      const api = pick(r, MDN_APIS)
      return { path: `/en-US/docs/Web/API/${api}`, title: `${api} - Web APIs | MDN` }
    },
  },
  {
    domain: 'news.ycombinator.com',
    make: (r, topic) => ({ path: `/item?id=${int(r, 100000, 60000000)}`, title: `${topic} | Hacker News` }),
  },
  {
    domain: 'www.youtube.com',
    make: (r, topic, slug) => {
      const roll = r()
      if (roll < 0.55) return { path: `/watch?v=${base62(r, 11)}`, title: `${topic} - YouTube` }
      if (roll < 0.68) return { path: `/shorts/${base62(r, 11)}`, title: `${topic} #shorts - YouTube` }
      if (roll < 0.8) return { path: `/playlist?list=PL${base62(r, 16)}`, title: `${topic} playlist - YouTube` }
      if (roll < 0.92) {
        const channel = pick(r, YT_CHANNELS)
        return { path: `/@${kebab(channel)}`, title: `${channel} - YouTube` }
      }
      return { path: `/results?search_query=${encodeURIComponent(slug)}`, title: `${topic} - YouTube` }
    },
  },
  {
    domain: 'youtu.be',
    make: (r, topic) => ({ path: `/${base62(r, 11)}`, title: `${topic} - YouTube` }),
  },
  {
    domain: 'zenn.dev',
    make: (r, topic, slug) => ({
      path: `/${pick(r, USERS)}/articles/${kebab(`${slug}-${base62(r, 6)}`)}`,
      title: `${topic} #TypeScript - Zenn`,
    }),
  },
  {
    domain: 'qiita.com',
    make: (r, topic) => ({
      path: `/${pick(r, USERS)}/items/${hex(r, 12)}`,
      title: `${topic} - Qiita`,
    }),
  },
  {
    domain: 'www.npmjs.com',
    make: (_r, topic, slug) => ({ path: `/package/${kebab(topic)}`, title: `${slug} - npm` }),
  },
  {
    domain: 'react.dev',
    make: (r) => {
      const hook = pick(r, ['useState', 'useOptimistic', 'useSyncExternalStore', 'useDeferredValue', 'useEffect'])
      return { path: `/reference/react/${hook}`, title: `${hook} – React` }
    },
  },
  {
    domain: 'vite.dev',
    make: (_r, topic, slug) => ({ path: `/guide/${kebab(slug)}`, title: `${topic} | Vite` }),
  },
  {
    domain: 'en.wikipedia.org',
    make: (_r, topic) => ({ path: `/wiki/${topic.replace(/ /g, '_')}`, title: `${topic} - Wikipedia` }),
  },
  {
    domain: 'www.reddit.com',
    make: (r, topic, slug) => ({
      path: `/r/${pick(r, SUBREDDITS)}/comments/${base62(r, 6)}/${kebab(slug)}/`,
      title: `${topic} : r/${pick(r, SUBREDDITS)}`,
    }),
  },
  {
    domain: 'linear.app',
    make: (r, topic) => {
      const n = int(r, 10, 900)
      return { path: `/team/HIS/issue/HIS-${n}`, title: `HIS-${n} · ${topic} · Linear` }
    },
  },
  {
    domain: 'chatgpt.com',
    make: (r, topic) => ({
      path: `/c/${hex(r, 8)}-${hex(r, 4)}-${hex(r, 4)}-${hex(r, 4)}-${hex(r, 12)}`,
      title: topic,
    }),
  },
  {
    domain: 'x.com',
    make: (r) => {
      const user = pick(r, USERS)
      return { path: `/${user}/status/${int(r, 1e18, 1.9e18)}`, title: `${user} / X` }
    },
  },
]

const NOW = Date.now()
const SPAN = 90 * DAY
const COUNT = 420

function build(): { items: HistoryItem[]; visits: Map<number, VisitItem[]> } {
  const r = mulberry32(0xc0ffee)
  const used = new Set<string>()
  const items: HistoryItem[] = []
  const visits = new Map<number, VisitItem[]>()
  let nextId = 1
  let nextVisitId = 1

  for (let i = 0; items.length < COUNT && i < COUNT * 20; i++) {
    const site = pick(r, SITES)
    const topic = pick(r, TOPICS)
    const { path, title } = site.make(r, topic, kebab(topic))
    const url = `https://${site.domain}${path}`
    if (used.has(url)) continue
    used.add(url)

    const age = Math.floor(Math.pow(r(), 2.2) * SPAN)
    const lastVisit = NOW - age
    const visitCount = 1 + Math.floor(Math.pow(r(), 2) * 7)
    const id = nextId++
    const vs: VisitItem[] = []
    let t = lastVisit
    for (let v = 0; v < visitCount && t > 0; v++) {
      vs.push({ id: nextVisitId++, urlId: id, transition: pick(r, TRANSITION_POOL), visitTime: t })
      t -= int(r, 3 * HOUR, 5 * DAY)
    }
    visits.set(id, vs)

    items.push({
      id,
      url,
      title,
      visitCount: vs.length,
      typedCount: vs.filter((v) => v.transition === 'typed').length,
      firstVisit: vs[vs.length - 1].visitTime,
      lastVisit,
    })
  }

  items.sort((a, b) => b.lastVisit - a.lastVisit)
  for (const vs of visits.values()) vs.sort((a, b) => b.visitTime - a.visitTime)
  return { items, visits }
}

const data = build()

export const MOCK_ITEMS: readonly HistoryItem[] = data.items
export const MOCK_VISITS: ReadonlyMap<number, VisitItem[]> = data.visits

// every profile on this machine, including ones never synced
export const MOCK_DISCOVERED: { browser: string; profile: string; sourcePath: string }[] = [
  { browser: 'brave', profile: 'Default', sourcePath: '/Users/*/Library/Application Support/BraveSoftware/Brave-Browser/Default/History' },
  { browser: 'brave', profile: 'Profile 2', sourcePath: '/Users/*/Library/Application Support/BraveSoftware/Brave-Browser/Profile 2/History' },
  { browser: 'chrome', profile: 'Default', sourcePath: '/Users/*/Library/Application Support/Google/Chrome/Default/History' },
  { browser: 'chrome', profile: 'Profile 1', sourcePath: '/Users/*/Library/Application Support/Google/Chrome/Profile 1/History' },
  { browser: 'arc', profile: 'Default', sourcePath: '/Users/*/Library/Application Support/Arc/User Data/Default/History' },
  { browser: 'vivaldi', profile: 'Default', sourcePath: '/Users/*/Library/Application Support/Vivaldi/Default/History' },
  { browser: 'firefox', profile: 'vpw8f8gt.default-release', sourcePath: '/Users/*/Library/Application Support/Firefox/Profiles/vpw8f8gt.default-release/places.sqlite' },
  { browser: 'safari', profile: 'default', sourcePath: '/Users/*/Library/Safari/History.db' },
  { browser: 'takeout', profile: 'History-2026-09-30', sourcePath: '~/.his/takeout/History-2026-09-30.json' },
]

export const MOCK_SOURCES: SourceProfile[] = [
  {
    id: 1,
    browser: 'brave',
    profile: 'Default',
    kind: 'chromium',
    sourcePath: '/Users/*/Library/Application Support/BraveSoftware/Brave-Browser/Default/History',
    checkpoint: { sourceProfileId: 1, lastSourceVisitId: 26463, sourceIdOffset: 0, lastRunAt: NOW - 4 * HOUR },
    visits: 26463,
    lastVisit: NOW - 4 * HOUR,
    pending: false,
  },
  {
    id: 2,
    browser: 'chrome',
    profile: 'Default',
    kind: 'chromium',
    sourcePath: '/Users/*/Library/Application Support/Google/Chrome/Default/History',
    checkpoint: { sourceProfileId: 2, lastSourceVisitId: 185, sourceIdOffset: 0, lastRunAt: NOW - 23 * DAY },
    visits: 185,
    lastVisit: NOW - 23 * DAY,
    pending: true,
  },
  {
    id: 3,
    browser: 'vivaldi',
    profile: 'Default',
    kind: 'chromium',
    sourcePath: '/Users/*/Library/Application Support/Vivaldi/Default/History',
    checkpoint: { sourceProfileId: 3, lastSourceVisitId: 23, sourceIdOffset: 0, lastRunAt: NOW - 5 * DAY },
    visits: 23,
    lastVisit: NOW - 5 * DAY,
    pending: true,
  },
  {
    id: 4,
    browser: 'safari',
    profile: 'default',
    kind: 'safari',
    sourcePath: '/Users/*/Library/Safari/History.db',
    checkpoint: { sourceProfileId: 4, lastSourceVisitId: 7, sourceIdOffset: 0, lastRunAt: NOW - 60 * DAY },
    visits: 7,
    lastVisit: NOW - 87 * DAY,
    pending: true,
  },
  {
    id: 5,
    browser: 'firefox',
    profile: 'vpw8f8gt.default-release',
    kind: 'firefox',
    sourcePath: '/Users/*/Library/Application Support/Firefox/Profiles/vpw8f8gt.default-release/places.sqlite',
    checkpoint: { sourceProfileId: 5, lastSourceVisitId: 2, sourceIdOffset: 0, lastRunAt: NOW - 40 * DAY },
    visits: 2,
    lastVisit: NOW - 300 * DAY,
    pending: false,
  },
  {
    id: 6,
    browser: 'takeout',
    profile: 'History-2026-09-30',
    kind: 'takeout',
    sourcePath: '~/.his/takeout/History-2026-09-30.json',
    checkpoint: { sourceProfileId: 6, lastSourceVisitId: 0, sourceIdOffset: 0, lastRunAt: null },
    visits: 0,
    lastVisit: null,
    pending: true,
  },
]
