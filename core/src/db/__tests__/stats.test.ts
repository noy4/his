import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { createDb, migrate, type KyselyDb } from '../db.ts'
import { monthRange, stats } from '../stats.ts'
import { sourceProfile, seedUrl } from '../../testing/db.ts'

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
  let handle: DatabaseSync
  let db: KyselyDb

  beforeEach(async () => {
    handle = new DatabaseSync(':memory:')
    await migrate(handle)
    db = createDb(handle)
  })

  afterEach(() => handle.close())

  for (const month of ['2026-10', '2026-12', '2024-02', '2026-03', '2026-11']) {
    it(`${month} includes month start and excludes next month start`, async () => {
      await db
        .insertInto('source_profiles')
        .values(sourceProfile)
        .execute()
      const [start, end] = monthRange(month)
      const times = [start - 1, start, start + 1, end - 1, end, end + 1]
      await seedUrl(db, { id: 1, url: 'https://github.com/foo/bar', title: 'foo/bar', times })

      const summary = await stats(db, month)
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

      await assert.rejects(() => stats(db, '2026-13'), /YYYY-MM/)
    })
  }
})
