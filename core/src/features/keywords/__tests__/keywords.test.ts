import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { createDb, migrate, type KyselyDb } from '../../../db/db.ts'
import { keywordsSearch, keywordsStats } from '../keywords.ts'
import { sourceProfile, seedUrl } from '../../../testing/db.ts'

const t1 = new Date('2026-10-05T10:00:00').getTime()
const t2 = new Date('2026-10-05T11:00:00').getTime()
const t3 = new Date('2026-10-07T09:00:00').getTime()
const tSep = new Date('2026-09-30T09:00:00').getTime()

describe('keywordsStats', () => {
  let handle: DatabaseSync
  let db: KyselyDb

  beforeEach(async () => {
    handle = new DatabaseSync(':memory:')
    await migrate(handle)
    db = createDb(handle)
    await db.insertInto('source_profiles').values(sourceProfile).execute()
  })

  afterEach(() => handle.close())

  it('sums searches, unique keywords, and daily counts', async () => {
    await seedUrl(db, { id: 1, url: 'https://www.google.com/search?q=Typescript+Generics', title: 'g', times: [t1, t2] })
    await seedUrl(db, { id: 2, url: 'https://www.bing.com/search?q=typescript%20generics', title: 'b', times: [t3] })
    await seedUrl(db, { id: 3, url: 'https://www.google.com/maps?q=paris', title: 'm', times: [t1] })
    await seedUrl(db, { id: 4, url: 'https://example.com/search?q=x', title: 'e', times: [t1] })

    const summary = await keywordsStats(db)
    assert.deepEqual(summary.totals, {
      searches: 3,
      keywords: 1,
      firstVisit: t1,
      lastVisit: t3,
    })
    assert.deepEqual(summary.byDay, [
      { day: '2026-10-05', visits: 2 },
      { day: '2026-10-07', visits: 1 },
    ])
  })

  it('scopes to a month', async () => {
    await seedUrl(db, { id: 1, url: 'https://www.google.com/search?q=a', title: 'a', times: [t1] })
    await seedUrl(db, { id: 2, url: 'https://www.google.com/search?q=b', title: 'b', times: [tSep] })

    const october = await keywordsStats(db, { month: '2026-10' })
    assert.deepEqual(october.totals, { searches: 1, keywords: 1, firstVisit: t1, lastVisit: t1 })

    const all = await keywordsStats(db)
    assert.deepEqual(all.totals, { searches: 2, keywords: 2, firstVisit: tSep, lastVisit: t1 })
  })
})

describe('keywordsSearch', () => {
  let handle: DatabaseSync
  let db: KyselyDb

  beforeEach(async () => {
    handle = new DatabaseSync(':memory:')
    await migrate(handle)
    db = createDb(handle)
    await db.insertInto('source_profiles').values(sourceProfile).execute()
  })

  afterEach(() => handle.close())

  it('lists search items newest first, excluding non-search URLs', async () => {
    await seedUrl(db, { id: 1, url: 'https://www.google.com/search?q=a', title: 'a', times: [t1] })
    await seedUrl(db, { id: 2, url: 'https://duckduckgo.com/?q=b', title: 'b', times: [t3] })
    await seedUrl(db, { id: 3, url: 'https://example.com/x', title: 'x', times: [t3] })

    const page = await keywordsSearch(db)
    assert.deepEqual(page.items.map((item) => item.url), [
      'https://duckduckgo.com/?q=b',
      'https://www.google.com/search?q=a',
    ])
    assert.equal(page.nextCursor, null)
    assert.deepEqual(page.items[0], {
      id: 2,
      url: 'https://duckduckgo.com/?q=b',
      title: 'b',
      visitCount: 1,
      typedCount: 0,
      firstVisit: t3,
      lastVisit: t3,
    })
  })

  it('pages with a cursor', async () => {
    await seedUrl(db, { id: 1, url: 'https://www.google.com/search?q=a', title: 'a', times: [t1] })
    await seedUrl(db, { id: 2, url: 'https://www.google.com/search?q=b', title: 'b', times: [t3] })

    const first = await keywordsSearch(db, { limit: 1 })
    assert.deepEqual(first.items.map((item) => item.id), [2])
    assert.ok(first.nextCursor)

    const second = await keywordsSearch(db, { limit: 1, cursor: first.nextCursor ?? undefined })
    assert.deepEqual(second.items.map((item) => item.id), [1])
    assert.equal(second.nextCursor, null)
  })
})
