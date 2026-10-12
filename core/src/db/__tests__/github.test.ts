import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { before, describe, it } from 'node:test'
import { migrate } from '../db.ts'
import { githubStats, githubVisits } from '../github.ts'
import { monthRange } from '../stats.ts'

// local-time ms so month buckets ('localtime') line up
const at = (iso: string) => new Date(iso).getTime()

const db = new DatabaseSync(':memory:')

function seed(url: string, title: string, times: string[]): void {
  const ms = times.map(at)
  const { id } = db.prepare(
    'INSERT INTO urls (url, title, first_visit_time, last_visit_time, visit_count) VALUES (?, ?, ?, ?, ?) RETURNING id',
  ).get(url, title, Math.min(...ms), Math.max(...ms), ms.length) as { id: number }
  for (const t of ms) {
    db.prepare('INSERT INTO visits (url_id, visit_time, transition, source_profile_id, source_visit_id) VALUES (?, ?, ?, 1, ?)')
      .run(id, t, 'link', Math.floor(Math.random() * 1e12))
  }
}

before(async () => {
  await migrate(db)
  db.prepare("INSERT INTO source_profiles (id, browser, profile, kind, profile_path) VALUES (1, 'chrome', 'Default', 'chromium', '/x')").run()
  seed('https://github.com/Foo/Bar', 'foo/bar · GitHub', ['2026-09-01T10:00', '2026-10-01T10:00', '2026-10-02T10:00'])
  seed('https://github.com/foo/bar/pull/12', 'Old title · Pull Request #12 · foo/bar', ['2026-10-03T10:00'])
  seed('https://github.com/foo/bar/pull/12/files', 'New title · Pull Request #12 · foo/bar', ['2026-10-04T10:00', '2026-10-05T10:00'])
  seed('https://github.com/foo/baz/issues/3', 'Bug · Issue #3 · foo/baz', ['2026-09-10T10:00'])
  seed('https://github.com/qux', 'qux', ['2026-10-06T10:00'])
  seed('https://github.com/settings/profile', 'Settings', ['2026-10-07T10:00'])
  seed('https://gist.github.com/foo/abc', 'gist', ['2026-10-07T10:00'])
  seed('https://example.com/foo/bar', 'other', ['2026-10-07T10:00'])
})

describe('GitHub URL variants', () => {
  for (const month of [undefined, '2026-10']) {
    it(`accepts HTTP/HTTPS with and without www (${month ?? 'all time'})`, async () => {
      const variantsDb = new DatabaseSync(':memory:')
      try {
        await migrate(variantsDb)
        variantsDb.prepare("INSERT INTO source_profiles (id, browser, profile, kind, profile_path) VALUES (1, 'chrome', 'Default', 'chromium', '/x')").run()
        const urls = [
          'https://github.com/foo/bar/tree/main',
          'https://www.github.com/foo/bar/tree/main',
          'http://github.com/foo/bar/tree/main',
          'http://www.github.com/foo/bar/tree/main',
        ]
        const times = [at('2026-09-01T10:00'), at('2026-10-01T10:00'), at('2026-10-02T10:00'), at('2026-11-01T10:00')]
        for (const [index, url] of urls.entries()) {
          const id = index + 1
          variantsDb.prepare('INSERT INTO urls (id, url, first_visit_time, last_visit_time, visit_count, typed_count) VALUES (?, ?, ?, ?, 4, 3)')
            .run(id, url, times[0]!, times.at(-1)!)
          for (const [visitIndex, time] of times.entries()) {
            variantsDb.prepare('INSERT INTO visits (url_id, visit_time, transition, source_profile_id, source_visit_id) VALUES (?, ?, ?, 1, ?)')
              .run(id, time, visitIndex === 2 ? 'link' : 'typed', index * times.length + visitIndex)
          }
        }
        const visitCount = month === undefined ? 4 : 2
        const typedCount = month === undefined ? 3 : 1
        const page = githubVisits(variantsDb, { month })
        assert.deepEqual(page.items.map((item) => item.url).sort(), [...urls].sort())
        assert.deepEqual(page.items.map((item) => item.visitCount), [visitCount, visitCount, visitCount, visitCount])
        assert.deepEqual(page.items.map((item) => item.typedCount), [typedCount, typedCount, typedCount, typedCount])
        assert.equal(githubStats(variantsDb, month).totals.visits, urls.length * visitCount)
      } finally {
        variantsDb.close()
      }
    })
  }
})

describe('githubStats', () => {
  it('all time', () => {
    const s = githubStats(db)
    assert.deepEqual(s.totals, {
      visits: 8, repos: 2, owners: 2, items: 2,
      firstVisit: at('2026-09-01T10:00'), lastVisit: at('2026-10-06T10:00'),
    })
    assert.deepEqual(s.topRepos, [
      { owner: 'foo', repo: 'bar', visits: 6 },
      { owner: 'foo', repo: 'baz', visits: 1 },
    ])
    assert.deepEqual(s.topOwners, [
      { owner: 'foo', repos: 2, visits: 7 },
      { owner: 'qux', repos: 0, visits: 1 },
    ])
    assert.deepEqual(s.topItems[0], {
      owner: 'foo', repo: 'bar', kind: 'pull', number: 12,
      title: 'New title', url: 'https://github.com/foo/bar/pull/12/files', visits: 3,
    })
    assert.equal(s.topItems[1]?.kind, 'issue')
  })

  it('month narrows to that month visits', () => {
    const s = githubStats(db, '2026-09')
    assert.deepEqual(s.totals, {
      visits: 2, repos: 2, owners: 1, items: 1,
      firstVisit: at('2026-09-01T10:00'), lastVisit: at('2026-09-10T10:00'),
    })
  })

  it('empty month', () => {
    assert.deepEqual(githubStats(db, '2020-01').totals, { visits: 0, repos: 0, owners: 0, items: 0, firstVisit: 0, lastVisit: 0 })
  })

  it('rejects bad month', () => {
    assert.throws(() => githubStats(db, '2026-13'))
  })
})

describe('githubVisits', () => {
  const urls = (p: Parameters<typeof githubVisits>[1]) => githubVisits(db, p).items.map((it) => it.url)

  it('newest first, github.com only', () => {
    assert.deepEqual(urls({}), [
      'https://github.com/qux',
      'https://github.com/foo/bar/pull/12/files',
      'https://github.com/foo/bar/pull/12',
      'https://github.com/Foo/Bar',
      'https://github.com/foo/baz/issues/3',
    ])
  })

  it('owner / repo filter (case-insensitive)', () => {
    assert.equal(urls({ owner: 'FOO' }).length, 4)
    assert.deepEqual(urls({ owner: 'foo', repo: 'baz' }), ['https://github.com/foo/baz/issues/3'])
  })

  it('kind filter', () => {
    assert.deepEqual(urls({ kind: 'repo' }), ['https://github.com/Foo/Bar'])
    assert.deepEqual(urls({ kind: 'other' }), ['https://github.com/qux'])
    assert.deepEqual(urls({ kind: 'issue_pr' }), [
      'https://github.com/foo/bar/pull/12/files',
      'https://github.com/foo/bar/pull/12',
      'https://github.com/foo/baz/issues/3',
    ])
  })

  it('month uses that month visits', () => {
    const page = githubVisits(db, { month: '2026-09' })
    assert.deepEqual(page.items.map((it) => [it.url, it.visitCount]), [
      ['https://github.com/foo/baz/issues/3', 1],
      ['https://github.com/Foo/Bar', 1],
    ])
    assert.deepEqual(page.items.map((item) => item.typedCount), [0, 0])
  })

  it('cursor pages without overlap', () => {
    const seen: string[] = []
    let cursor: string | undefined
    do {
      const page = githubVisits(db, { limit: 2, cursor })
      seen.push(...page.items.map((it) => it.url))
      cursor = page.nextCursor ?? undefined
    } while (cursor)
    assert.deepEqual(seen, urls({}))
  })

  it('preserves merged counts and cursor ordering with owner / repo / kind filters', async () => {
    const rootsDb = new DatabaseSync(':memory:')
    try {
      await migrate(rootsDb)
      rootsDb.prepare("INSERT INTO source_profiles (id, browser, profile, kind, profile_path) VALUES (1, 'chrome', 'Default', 'chromium', '/x')").run()
      const rows = [
        ['https://github.com/foo/bar?tab=readme', '2026-10-10T10:00', 'typed'],
        ['https://github.com/foo/bar#readme', '2026-10-01T10:00', 'link'],
        ['https://github.com/foo/bar/', '2026-10-10T10:00', 'typed'],
        ['https://github.com/foo/baz', '2026-10-04T10:00', 'link'],
        ['https://github.com/qux/bar', '2026-10-03T10:00', 'link'],
        ['https://github.com/foo/bar/tree/main', '2026-10-02T10:00', 'link'],
        ['https://github.com/foo/bar/pull/1', '2026-10-02T10:00', 'link'],
      ] as const
      for (const [index, [url, time, transition]] of rows.entries()) {
        const id = index + 1
        rootsDb.prepare('INSERT INTO urls (id, url, title, first_visit_time, last_visit_time, visit_count, typed_count) VALUES (?, ?, ?, ?, ?, 1, ?)')
          .run(id, url, `title${id}`, at(time), at(time), transition === 'typed' ? 1 : 0)
        rootsDb.prepare('INSERT INTO visits (url_id, visit_time, transition, source_profile_id, source_visit_id) VALUES (?, ?, ?, 1, ?)')
          .run(id, at(time), transition, id)
      }
      const root = 'https://github.com/foo/bar'
      const baz = 'https://github.com/foo/baz'
      const qux = 'https://github.com/qux/bar'
      const pull = 'https://github.com/foo/bar/pull/1'
      const code = 'https://github.com/foo/bar/tree/main'
      const cases: [NonNullable<Parameters<typeof githubVisits>[1]>, string[]][] = [
        [{}, [root, baz, qux, pull, code]],
        [{ owner: 'FOO', repo: 'BAR' }, [root, pull, code]],
        [{ kind: 'repo' }, [root, baz, qux]],
        [{ owner: 'foo', kind: 'repo' }, [root, baz]],
        [{ repo: 'bar', kind: 'repo' }, [root, qux]],
        [{ kind: 'other' }, [code]],
        [{ kind: 'issue_pr' }, [pull]],
      ]
      for (const month of [undefined, '2026-10']) {
        const [merged] = githubVisits(rootsDb, { month, owner: 'foo', repo: 'bar', kind: 'repo' }).items
        assert.deepEqual(merged, {
          id: 3, url: root, title: 'title3', visitCount: 3, typedCount: 2,
          firstVisit: at('2026-10-01T10:00'), lastVisit: at('2026-10-10T10:00'),
        })
        for (const [filter, expectedUrls] of cases) {
          const expected = githubVisits(rootsDb, { ...filter, month }).items
          assert.deepEqual(expected.map((item) => item.url), expectedUrls)
          const seen = []
          let cursor: string | undefined
          do {
            const page = githubVisits(rootsDb, { ...filter, month, limit: 1, cursor })
            seen.push(...page.items)
            cursor = page.nextCursor ?? undefined
          } while (cursor)
          assert.deepEqual(seen, expected)
        }
      }
    } finally {
      rootsDb.close()
    }
  })
})

describe('month boundaries', () => {
  for (const month of ['2026-10', '2026-12', '2024-02', '2026-03', '2026-11']) {
    it(`${month} includes month start and excludes next month start`, async () => {
      const boundaryDb = new DatabaseSync(':memory:')
      try {
        await migrate(boundaryDb)
        boundaryDb.prepare("INSERT INTO source_profiles (id, browser, profile, kind, profile_path) VALUES (1, 'chrome', 'Default', 'chromium', '/x')").run()
        const [start, end] = monthRange(month)
        const times = [start - 1, start, start + 1, end - 1, end, end + 1]
        boundaryDb.prepare(
          'INSERT INTO urls (id, url, title, first_visit_time, last_visit_time, visit_count) VALUES (1, ?, ?, ?, ?, ?)',
        ).run('https://github.com/foo/bar', 'foo/bar', times[0]!, times.at(-1)!, times.length)
        for (const [index, time] of times.entries()) {
          boundaryDb.prepare('INSERT INTO visits (url_id, visit_time, transition, source_profile_id, source_visit_id) VALUES (1, ?, ?, 1, ?)')
            .run(time, 'link', index)
        }

        assert.deepEqual(githubStats(boundaryDb, month).totals, {
          visits: 3, repos: 1, owners: 1, items: 0, firstVisit: start, lastVisit: end - 1,
        })
        const [item] = githubVisits(boundaryDb, { month }).items
        assert.equal(item?.visitCount, 3)
        assert.equal(item?.firstVisit, start)
        assert.equal(item?.lastVisit, end - 1)
        assert.throws(() => githubStats(boundaryDb, '2026-13'), /YYYY-MM/)
        assert.throws(() => githubVisits(boundaryDb, { month: '2026-13' }), /YYYY-MM/)
      } finally {
        boundaryDb.close()
      }
    })
  }
})
