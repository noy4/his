import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { describe, it } from 'node:test'
import { migrate } from './db.ts'
import { githubStats, githubVisits } from './github-stats.ts'
import { monthRange, stats } from './stats.ts'

describe('monthRange', () => {
  const cases = [
    ['2026-10', '2026-10-01', '2026-11-01'],
    ['2026-12', '2026-12-01', '2027-01-01'],
    ['2024-02', '2024-02-01', '2024-03-01'],
    ['2026-03', '2026-03-01', '2026-04-01'],
    ['2026-11', '2026-11-01', '2026-12-01'],
    ['0099-12', '0099-12-01', '0100-01-01'],
    ['0000-01', '0000-01-01', '0000-02-01'],
  ] as const
  for (const [month, start, end] of cases) {
    it(`${month} uses local midnight boundaries`, () => {
      assert.deepEqual(monthRange(month), [
        new Date(`${start}T00:00:00`).getTime(),
        new Date(`${end}T00:00:00`).getTime(),
      ])
    })
  }

  it('rejects invalid months', () => {
    for (const month of ['2026-00', '2026-13', '2026-1', '26-01', ''])
      assert.throws(() => monthRange(month), /YYYY-MM/)
  })
})

describe('monthly queries', () => {
  for (const month of ['2026-10', '2026-12', '2024-02', '2026-03', '2026-11']) {
    it(`${month} includes month start and excludes next month start`, async () => {
      const db = new DatabaseSync(':memory:')
      try {
        await migrate(db)
        db.prepare("INSERT INTO source_profiles (id, browser, profile, kind, profile_path) VALUES (1, 'chrome', 'Default', 'chromium', '/x')").run()
        const [start, end] = monthRange(month)
        const times = [start - 1, start, start + 1, end - 1, end, end + 1]
        db.prepare(
          'INSERT INTO urls (id, url, title, first_visit_time, last_visit_time, visit_count) VALUES (1, ?, ?, ?, ?, ?)',
        ).run('https://github.com/foo/bar', 'foo/bar', times[0]!, times.at(-1)!, times.length)
        for (const [index, time] of times.entries()) {
          db.prepare('INSERT INTO visits (url_id, visit_time, transition, source_profile_id, source_visit_id) VALUES (1, ?, ?, 1, ?)')
            .run(time, 'link', index)
        }

        const summary = stats(db, month)
        assert.deepEqual(summary.totals, {
          items: 1, visits: 3, domains: 1, firstVisit: start, lastVisit: end - 1,
        })
        assert.deepEqual(summary.topDomains, [{ domain: 'github.com', visits: 3 }])
        assert.equal(summary.byHour[0]?.visits, 2)
        assert.equal(summary.byHour[23]?.visits, 1)
        const expectedDow = Array.from({ length: 7 }, () => 0)
        for (const time of [start, start + 1, end - 1])
          expectedDow[new Date(time).getDay()]! += 1
        assert.deepEqual(summary.byDow.map((bucket) => bucket.visits), expectedDow)
        assert.deepEqual(summary.busiestDays, [
          { day: `${month}-01`, visits: 2 },
          { day: `${month}-${new Date(end - 1).getDate()}`, visits: 1 },
        ])

        assert.deepEqual(githubStats(db, month).totals, {
          visits: 3, repos: 1, owners: 1, items: 0, firstVisit: start, lastVisit: end - 1,
        })
        const [item] = githubVisits(db, { month }).items
        assert.equal(item?.visitCount, 3)
        assert.equal(item?.firstVisit, start)
        assert.equal(item?.lastVisit, end - 1)
        assert.throws(() => stats(db, '2026-13'), /YYYY-MM/)
        assert.throws(() => githubVisits(db, { month: '2026-13' }), /YYYY-MM/)
      } finally {
        db.close()
      }
    })
  }
})
