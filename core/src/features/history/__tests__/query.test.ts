import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { createDb, migrate, type KyselyDb } from '../../../db/db.ts'
import { decodeCursor, encodeCursor } from '../../../db/query/paging.ts'
import { getVisits, search, searchVisits } from '../query.ts'
import { sourceProfile } from '../../../testing/db.ts'

let handle: DatabaseSync
let db: KyselyDb

beforeEach(async () => {
  handle = new DatabaseSync(':memory:')
  await migrate(handle)
  db = createDb(handle)
  await db
    .insertInto('source_profiles')
    .values(sourceProfile)
    .execute()
  await db
    .insertInto('urls')
    .values([
      { id: 10, url: 'https://example.com/guide', title: 'Example guide', first_visit_time: 100, last_visit_time: 9000, visit_count: 99, typed_count: 5 },
      { id: 20, url: 'https://other.com/page', title: null, first_visit_time: 200, last_visit_time: 500, visit_count: 7, typed_count: 1 },
      { id: 30, url: 'https://unvisited.com/', title: 'No visits', first_visit_time: 0, last_visit_time: 10000, visit_count: 0, typed_count: 0 },
    ])
    .execute()
  await db
    .insertInto('visits')
    .values([
      { id: 101, url_id: 10, visit_time: 100, transition: 'typed' },
      { id: 102, url_id: 10, visit_time: 300, transition: 'link' },
      { id: 103, url_id: 10, visit_time: 300, transition: 'reload' },
      { id: 204, url_id: 20, visit_time: 200, transition: 'link' },
      { id: 205, url_id: 20, visit_time: 400, transition: 'typed' },
    ].map((visit) => ({ ...visit, source_profile_id: 1, source_visit_id: visit.id })))
    .execute()
})

afterEach(() => handle.close())

describe('searchVisits', () => {
  it('returns every visit, with visit identity and cumulative URL metadata', async () => {
    const page = await searchVisits(db)
    assert.deepEqual(page.items.map((item) => item.id), [205, 103, 102, 204, 101])
    assert.deepEqual(page.items[0], {
      id: 205, urlId: 20, visitTime: 400, transition: 'typed',
      url: 'https://other.com/page', title: '', visitCount: 7,
    })
    assert.deepEqual(page.items[1], {
      id: 103, urlId: 10, visitTime: 300, transition: 'reload',
      url: 'https://example.com/guide', title: 'Example guide', visitCount: 99,
    })
    assert.equal(page.nextCursor, null)
  })

  it('filters inclusively on visit time without reducing cumulative counts', async () => {
    const page = await searchVisits(db, { from: 200, to: 300 })
    assert.deepEqual(page.items.map((item) => [item.id, item.visitCount]), [[103, 99], [102, 99], [204, 7]])
    assert.deepEqual((await searchVisits(db, { from: 300, to: 300 })).items.map((item) => item.id), [103, 102])
    assert.deepEqual((await searchVisits(db, { from: 400 })).items.map((item) => item.id), [205])
    assert.deepEqual((await searchVisits(db, { to: 100 })).items.map((item) => item.id), [101])
    assert.deepEqual(await searchVisits(db, { from: 300, to: 200 }), { items: [], nextCursor: null })
  })

  it('combines exact URL, query, and visit-time filters', async () => {
    assert.deepEqual((await searchVisits(db, {
      url: 'https://example.com/guide', query: ' GUIDE ', from: 300, to: 300,
    })).items.map((item) => item.id), [103, 102])
    assert.deepEqual(await searchVisits(db, { url: 'https://example.com' }), { items: [], nextCursor: null })
    assert.deepEqual(await searchVisits(db, { url: 'https://example.com/guide', query: 'other' }), { items: [], nextCursor: null })
  })

  it('pages tied timestamps by descending visit ID without duplicates or omissions', async () => {
    const first = await searchVisits(db, { limit: 2 })
    assert.deepEqual(first.items.map((item) => item.id), [205, 103])
    assert.deepEqual(decodeCursor(first.nextCursor!), [300, 103])
    const second = await searchVisits(db, { limit: 2, cursor: first.nextCursor! })
    assert.deepEqual(second.items.map((item) => item.id), [102, 204])
    assert.deepEqual(decodeCursor(second.nextCursor!), [200, 204])
    const third = await searchVisits(db, { limit: 2, cursor: second.nextCursor! })
    assert.deepEqual(third.items.map((item) => item.id), [101])
    assert.equal(third.nextCursor, null)
    assert.deepEqual(await searchVisits(db, { cursor: encodeCursor(100, 101) }), { items: [], nextCursor: null })
  })

  it('keeps query filters applied across pages and omits cursors on exact-size pages', async () => {
    for (const query of ['gu', 'guide']) {
      const first = await searchVisits(db, { query, limit: 1 })
      assert.deepEqual(first.items.map((item) => item.id), [103])
      const second = await searchVisits(db, { query, limit: 2, cursor: first.nextCursor! })
      assert.deepEqual(second.items.map((item) => item.id), [102, 101])
      assert.equal(second.nextCursor, null)
    }
  })
})

describe('shared search behavior', () => {
  it('ignores malformed cursors', async () => {
    for (const find of [search, searchVisits]) {
      for (const cursor of ['', 'bad', 'v2:WzMwMCwxMDNd', 'v1:!', 'v1:e30', 'v1:WzFd', 'v1:WyJhIiwxXQ']) {
        assert.deepEqual(await find(db, { cursor, limit: 2 }), await find(db, { limit: 2 }))
      }
    }
  })

  it('handles no matches, whitespace queries, and empty databases', async () => {
    for (const find of [search, searchVisits]) {
      assert.deepEqual(await find(db, { query: 'missing' }), { items: [], nextCursor: null })
      assert.deepEqual(await find(db, { query: ' \t ' }), await find(db))
    }
    await db.deleteFrom('visits').execute()
    await db.deleteFrom('urls').execute()
    for (const find of [search, searchVisits]) {
      assert.deepEqual(await find(db), { items: [], nextCursor: null })
    }
  })

  it('uses default limits and clamps explicit limits', async () => {
    const ids = Array.from({ length: 205 }, (_, i) => 1000 + i)
    await db
      .insertInto('urls')
      .values(ids.map((id) => ({ id, url: `https://limit.test/${id}`, first_visit_time: 300, last_visit_time: 300, visit_count: 1 })))
      .execute()
    await db
      .insertInto('visits')
      .values(ids.map((id) => ({ id, url_id: id, visit_time: 300, transition: 'link', source_profile_id: 1, source_visit_id: id })))
      .execute()
    for (const find of [search, searchVisits]) {
      assert.equal((await find(db, { limit: 0 })).items.length, 1)
      assert.equal((await find(db, { limit: 2.9 })).items.length, 2)
      for (const limit of [undefined, NaN, Infinity]) {
        assert.equal((await find(db, { limit })).items.length, 50)
      }
      assert.equal((await find(db, { limit: 1000 })).items.length, 200)
    }
  })

  for (const field of ['title', 'url'] as const) {
    for (const query of ['xy', 'needle', '%', '_', '\\', '"', 'a"', 'a"b', '100%done', 'under_score', 'path\\value', '\u65e5\u672c', '\u65e5\u672c\u8a9e', '\u{1f600}\u{1f680}', '\u{1f600}\u{1f680}\u{1f30d}']) {
      it(`matches literal ${JSON.stringify(query)} in ${field} using short/long query semantics`, async () => {
        const url = field === 'url' ? `https://match.test/${query}/end` : 'https://match.test/plain'
        const title = field === 'title' ? `prefix ${query} suffix` : 'Plain title'
        await db
          .insertInto('urls')
          .values({ id: 40, url, title, first_visit_time: 600, last_visit_time: 600, visit_count: 12 })
          .execute()
        await db
          .insertInto('visits')
          .values({ id: 406, url_id: 40, visit_time: 600, transition: 'link', source_profile_id: 1, source_visit_id: 406 })
          .execute()
        assert.deepEqual((await searchVisits(db, { query: ` ${query} ` })).items.map((item) => item.id), [406])
        assert.deepEqual((await search(db, { query })).items.map((item) => item.id), [40])
      })
    }
  }
})

describe('search', () => {
  it('preserves URL search aggregation, lastVisit ranges, cursors, and getVisits', async () => {
    assert.deepEqual((await search(db)).items.map((item) => item.id), [30, 10, 20])
    const first = await search(db, { limit: 2 })
    assert.deepEqual(first.items[1], {
      id: 10, url: 'https://example.com/guide', title: 'Example guide', visitCount: 99,
      typedCount: 5, firstVisit: 100, lastVisit: 9000,
    })
    assert.deepEqual(decodeCursor(first.nextCursor!), [9000, 10])
    assert.deepEqual((await search(db, { limit: 2, cursor: first.nextCursor! })).items.map((item) => item.id), [20])
    assert.deepEqual(await search(db, { from: 200, to: 300 }), { items: [], nextCursor: null })
    assert.deepEqual((await search(db, { from: 500, to: 500 })).items.map((item) => item.id), [20])
    assert.deepEqual((await search(db, { query: 'guide' })).items.map((item) => item.id), [10])
    assert.deepEqual(await getVisits(db, 20), [
      { id: 205, urlId: 20, visitTime: 400, transition: 'typed' },
      { id: 204, urlId: 20, visitTime: 200, transition: 'link' },
    ])
    assert.deepEqual(await getVisits(db, 20, 1), [{ id: 205, urlId: 20, visitTime: 400, transition: 'typed' }])
  })
})
