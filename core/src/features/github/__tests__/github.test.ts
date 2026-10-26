import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { before, describe, it } from 'node:test'
import { createDb, migrate, type KyselyDb } from '../../../db/db.ts'
import { githubStats, githubVisits } from '../github.ts'
import { monthRange } from '../../../db/query/filters.ts'
import { sourceProfile, seedUrl } from '../../../testing/db.ts'

// local-time ms so month buckets ('localtime') line up
const at = (iso: string) => new Date(iso).getTime()

const handle = new DatabaseSync(':memory:')
const db = createDb(handle)

async function seed(url: string, title: string, times: string[]): Promise<void> {
  await seedUrl(db, { url, title, times: times.map(at) })
}

before(async () => {
  await migrate(handle)
  await db.insertInto('source_profiles').values(sourceProfile).execute()
  await seed('https://github.com/Foo/Bar', 'foo/bar · GitHub', ['2026-09-01T10:00', '2026-10-01T10:00', '2026-10-02T10:00'])
  await seed('https://github.com/foo/bar/pull/12', 'Old title · Pull Request #12 · foo/bar', ['2026-10-03T10:00'])
  await seed('https://github.com/foo/bar/pull/12/files', 'New title · Pull Request #12 · foo/bar', ['2026-10-04T10:00', '2026-10-05T10:00'])
  await seed('https://github.com/foo/baz/issues/3', 'Bug · Issue #3 · foo/baz', ['2026-09-10T10:00'])
  await seed('https://github.com/qux', 'qux', ['2026-10-06T10:00'])
  await seed('https://github.com/settings/profile', 'Settings', ['2026-10-07T10:00'])
  await seed('https://gist.github.com/foo/abc', 'gist', ['2026-10-07T10:00'])
  await seed('https://example.com/foo/bar', 'other', ['2026-10-07T10:00'])
})

describe('githubStats', () => {
  it('all time', async () => {
    const s = await githubStats(db)
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
    assert.deepEqual(s.byDay, [
      { day: '2026-09-01', all: 1, repo: 1, issue_pr: 0, other: 0 },
      { day: '2026-09-10', all: 1, repo: 0, issue_pr: 1, other: 0 },
      { day: '2026-10-01', all: 1, repo: 1, issue_pr: 0, other: 0 },
      { day: '2026-10-02', all: 1, repo: 1, issue_pr: 0, other: 0 },
      { day: '2026-10-03', all: 1, repo: 0, issue_pr: 1, other: 0 },
      { day: '2026-10-04', all: 1, repo: 0, issue_pr: 1, other: 0 },
      { day: '2026-10-05', all: 1, repo: 0, issue_pr: 1, other: 0 },
      { day: '2026-10-06', all: 1, repo: 0, issue_pr: 0, other: 1 },
    ])
    assert.deepEqual(
      s.byDayTop.map((d) => ({ day: d.day, repo: d.repo.map((i) => i.key), issue_pr: d.issue_pr.map((i) => i.key), other: d.other.map((i) => i.key) })),
      [
        { day: '2026-09-01', repo: ['repo:foo/bar'], issue_pr: [], other: [] },
        { day: '2026-09-10', repo: [], issue_pr: ['issue:foo/baz/issue/3'], other: [] },
        { day: '2026-10-01', repo: ['repo:foo/bar'], issue_pr: [], other: [] },
        { day: '2026-10-02', repo: ['repo:foo/bar'], issue_pr: [], other: [] },
        { day: '2026-10-03', repo: [], issue_pr: ['issue:foo/bar/pull/12'], other: [] },
        { day: '2026-10-04', repo: [], issue_pr: ['issue:foo/bar/pull/12'], other: [] },
        { day: '2026-10-05', repo: [], issue_pr: ['issue:foo/bar/pull/12'], other: [] },
        { day: '2026-10-06', repo: [], issue_pr: [], other: ['other:qux'] },
      ],
    )
    assert.deepEqual(s.byDayTop.find((d) => d.day === '2026-10-03')?.issue_pr[0], {
      key: 'issue:foo/bar/pull/12', kind: 'issue_pr', owner: 'foo', repo: 'bar',
      number: 12, pullKind: 'pull', visits: 1, lastVisit: at('2026-10-03T10:00'),
    })
  })

  it('byDayTop: most recent first, capped per kind', async () => {
    const h = new DatabaseSync(':memory:')
    try {
      await migrate(h)
      const tdb = createDb(h)
      await tdb.insertInto('source_profiles').values(sourceProfile).execute()
      await seedUrl(tdb, { id: 1, url: 'https://github.com/a/one', title: 'a/one', times: [at('2026-10-10T10:00')] })
      await seedUrl(tdb, { id: 2, url: 'https://github.com/b/two', title: 'b/two', times: [at('2026-10-10T12:00')] })
      await seedUrl(tdb, { id: 3, url: 'https://github.com/c/three', title: 'c/three', times: [at('2026-10-10T11:00')] })
      await seedUrl(tdb, { id: 4, url: 'https://github.com/d/four', title: 'd/four', times: [at('2026-10-10T13:00')] })
      await seedUrl(tdb, { id: 5, url: 'https://github.com/a/one/pull/1', title: 'PR · Pull Request #1 · a/one', times: [at('2026-10-10T09:00')] })

      const [day] = (await githubStats(tdb)).byDayTop
      assert.equal(day?.day, '2026-10-10')
      // recency order (d 13:00, b 12:00, c 11:00); a (10:00) dropped by the top-3 cap
      assert.deepEqual(day?.repo.map((i) => `${i.owner}/${i.repo}:${i.visits}`), ['d/four:1', 'b/two:1', 'c/three:1'])
      assert.deepEqual(day?.issue_pr.map((i) => i.key), ['issue:a/one/pull/1'])
      assert.equal(day?.other.length, 0)
    } finally {
      h.close()
    }
  })

  it('month narrows to that month visits', async () => {
    const s = await githubStats(db, '2026-09')
    assert.deepEqual(s.totals, {
      visits: 2, repos: 2, owners: 1, items: 1,
      firstVisit: at('2026-09-01T10:00'), lastVisit: at('2026-09-10T10:00'),
    })
    assert.deepEqual(s.byDay, [
      { day: '2026-09-01', all: 1, repo: 1, issue_pr: 0, other: 0 },
      { day: '2026-09-10', all: 1, repo: 0, issue_pr: 1, other: 0 },
    ])
    assert.deepEqual(
      s.byDayTop.map((d) => ({ day: d.day, repo: d.repo.map((i) => i.key), issue_pr: d.issue_pr.map((i) => i.key), other: d.other.map((i) => i.key) })),
      [
        { day: '2026-09-01', repo: ['repo:foo/bar'], issue_pr: [], other: [] },
        { day: '2026-09-10', repo: [], issue_pr: ['issue:foo/baz/issue/3'], other: [] },
      ],
    )
  })

  it('empty month', async () => {
    assert.deepEqual((await githubStats(db, '2020-01')).totals, { visits: 0, repos: 0, owners: 0, items: 0, firstVisit: 0, lastVisit: 0 })
    assert.deepEqual((await githubStats(db, '2020-01')).byDay, [])
    assert.deepEqual((await githubStats(db, '2020-01')).byDayTop, [])
  })

  it('rejects bad month', async () => {
    await assert.rejects(() => githubStats(db, '2026-13'))
  })
})

describe('githubVisits', () => {
  const urls = async (p: Parameters<typeof githubVisits>[1]) => (await githubVisits(db, p)).items.map((it) => it.url)

  it('newest first, github.com only', async () => {
    assert.deepEqual(await urls({}), [
      'https://github.com/qux',
      'https://github.com/foo/bar/pull/12/files',
      'https://github.com/foo/bar/pull/12',
      'https://github.com/Foo/Bar',
      'https://github.com/foo/baz/issues/3',
    ])
  })

  it('owner / repo filter (case-insensitive)', async () => {
    assert.equal((await urls({ owner: 'FOO' })).length, 4)
    assert.deepEqual(await urls({ owner: 'foo', repo: 'baz' }), ['https://github.com/foo/baz/issues/3'])
  })

  it('kind filter', async () => {
    assert.deepEqual(await urls({ kind: 'repo' }), ['https://github.com/Foo/Bar'])
    assert.deepEqual(await urls({ kind: 'other' }), ['https://github.com/qux'])
    assert.deepEqual(await urls({ kind: 'issue_pr' }), [
      'https://github.com/foo/bar/pull/12/files',
      'https://github.com/foo/bar/pull/12',
      'https://github.com/foo/baz/issues/3',
    ])
  })

  it('month uses that month visits', async () => {
    const page = await githubVisits(db, { month: '2026-09' })
    assert.deepEqual(page.items.map((it) => [it.url, it.visitCount]), [
      ['https://github.com/foo/baz/issues/3', 1],
      ['https://github.com/Foo/Bar', 1],
    ])
    assert.deepEqual(page.items.map((item) => item.typedCount), [0, 0])
  })

  it('cursor pages without overlap', async () => {
    const seen: string[] = []
    let cursor: string | undefined
    do {
      const page = await githubVisits(db, { limit: 2, cursor })
      seen.push(...page.items.map((it) => it.url))
      cursor = page.nextCursor ?? undefined
    } while (cursor)
    assert.deepEqual(seen, await urls({}))
  })

  it('preserves merged counts and cursor ordering with owner / repo / kind filters', async () => {
    const rootsHandle = new DatabaseSync(':memory:')
    try {
      await migrate(rootsHandle)
      const rdb = createDb(rootsHandle)
      await rdb.insertInto('source_profiles').values(sourceProfile).execute()
      const rows = [
        ['https://github.com/foo/bar?tab=readme', '2026-10-10T10:00', 'typed'],
        ['https://github.com/foo/bar#readme', '2026-10-01T10:00', 'link'],
        ['https://github.com/foo/bar/', '2026-10-10T10:00', 'typed'],
        ['https://github.com/foo/baz', '2026-10-04T10:00', 'link'],
        ['https://github.com/qux/bar', '2026-10-03T10:00', 'link'],
        ['https://github.com/foo/bar/tree/main', '2026-10-02T10:00', 'link'],
        ['https://github.com/foo/bar/pull/1', '2026-10-02T10:00', 'link'],
      ] as const
      const seeded = rows.map(([url, time, transition], index) => ({ id: index + 1, url, time, transition }))
      await rdb
        .insertInto('urls')
        .values(seeded.map(({ id, url, time, transition }) => ({
          id,
          url,
          title: `title${id}`,
          first_visit_time: at(time),
          last_visit_time: at(time),
          visit_count: 1,
          typed_count: transition === 'typed' ? 1 : 0,
        })))
        .execute()
      await rdb
        .insertInto('visits')
        .values(seeded.map(({ id, time, transition }) => ({
          url_id: id,
          visit_time: at(time),
          transition,
          source_profile_id: sourceProfile.id,
          source_visit_id: id,
        })))
        .execute()
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
        const [merged] = (await githubVisits(rdb, { month, owner: 'foo', repo: 'bar', kind: 'repo' })).items
        assert.deepEqual(merged, {
          id: 3, url: root, title: 'title3', visitCount: 3, typedCount: 2,
          firstVisit: at('2026-10-01T10:00'), lastVisit: at('2026-10-10T10:00'),
        })
        for (const [filter, expectedUrls] of cases) {
          const expected = (await githubVisits(rdb, { ...filter, month })).items
          assert.deepEqual(expected.map((item) => item.url), expectedUrls)
          const seen = []
          let cursor: string | undefined
          do {
            const page = await githubVisits(rdb, { ...filter, month, limit: 1, cursor })
            seen.push(...page.items)
            cursor = page.nextCursor ?? undefined
          } while (cursor)
          assert.deepEqual(seen, expected)
        }
      }
    } finally {
      rootsHandle.close()
    }
  })
})

describe('month boundaries', () => {
  for (const month of ['2026-10', '2026-12', '2024-02', '2026-03', '2026-11']) {
    it(`${month} includes month start and excludes next month start`, async () => {
      const boundaryHandle = new DatabaseSync(':memory:')
      try {
        await migrate(boundaryHandle)
        const bdb: KyselyDb = createDb(boundaryHandle)
        await bdb.insertInto('source_profiles').values(sourceProfile).execute()
        const [start, end] = monthRange(month)
        const times = [start - 1, start, start + 1, end - 1, end, end + 1]
        await seedUrl(bdb, { id: 1, url: 'https://github.com/foo/bar', title: 'foo/bar', times })

        assert.deepEqual((await githubStats(bdb, month)).totals, {
          visits: 3, repos: 1, owners: 1, items: 0, firstVisit: start, lastVisit: end - 1,
        })
        const [item] = (await githubVisits(bdb, { month })).items
        assert.equal(item?.visitCount, 3)
        assert.equal(item?.firstVisit, start)
        assert.equal(item?.lastVisit, end - 1)
        await assert.rejects(() => githubStats(bdb, '2026-13'), /YYYY-MM/)
        await assert.rejects(() => githubVisits(bdb, { month: '2026-13' }), /YYYY-MM/)
      } finally {
        boundaryHandle.close()
      }
    })
  }
})
