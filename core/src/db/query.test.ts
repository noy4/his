import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { migrate } from './db.ts'
import { decodeCursor, encodeCursor, getVisits, search, searchVisits } from './query.ts'

let db: DatabaseSync

beforeEach(async () => {
  db = new DatabaseSync(':memory:')
  await migrate(db)
  db.prepare("INSERT INTO source_profiles (id, browser, profile, kind, profile_path) VALUES (1, 'chrome', 'Default', 'chromium', '/x')").run()
  const insertUrl = db.prepare('INSERT INTO urls (id, url, title, first_visit_time, last_visit_time, visit_count, typed_count) VALUES (?, ?, ?, ?, ?, ?, ?)')
  insertUrl.run(10, 'https://example.com/guide', 'Example guide', 100, 9000, 99, 5)
  insertUrl.run(20, 'https://other.com/page', null, 200, 500, 7, 1)
  insertUrl.run(30, 'https://unvisited.com/', 'No visits', 0, 10000, 0, 0)
  const insertVisit = db.prepare('INSERT INTO visits (id, url_id, visit_time, transition, source_profile_id, source_visit_id) VALUES (?, ?, ?, ?, 1, ?)')
  for (const [id, urlId, time, transition] of [
    [101, 10, 100, 'typed'],
    [102, 10, 300, 'link'],
    [103, 10, 300, 'reload'],
    [204, 20, 200, 'link'],
    [205, 20, 400, 'typed'],
  ] as const) {
    insertVisit.run(id, urlId, time, transition, id)
  }
})

afterEach(() => db.close())

describe('searchVisits', () => {
  it('returns every visit, with visit identity and cumulative URL metadata', () => {
    const page = searchVisits(db)
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

  it('filters inclusively on visit time without reducing cumulative counts', () => {
    const page = searchVisits(db, { from: 200, to: 300 })
    assert.deepEqual(page.items.map((item) => [item.id, item.visitCount]), [[103, 99], [102, 99], [204, 7]])
    assert.deepEqual(searchVisits(db, { from: 300, to: 300 }).items.map((item) => item.id), [103, 102])
    assert.deepEqual(searchVisits(db, { from: 400 }).items.map((item) => item.id), [205])
    assert.deepEqual(searchVisits(db, { to: 100 }).items.map((item) => item.id), [101])
    assert.deepEqual(searchVisits(db, { from: 300, to: 200 }), { items: [], nextCursor: null })
  })

  it('combines exact URL, query, and visit-time filters', () => {
    assert.deepEqual(searchVisits(db, {
      url: 'https://example.com/guide', query: ' GUIDE ', from: 300, to: 300,
    }).items.map((item) => item.id), [103, 102])
    assert.deepEqual(searchVisits(db, { url: 'https://example.com' }), { items: [], nextCursor: null })
    assert.deepEqual(searchVisits(db, { url: 'https://example.com/guide', query: 'other' }), { items: [], nextCursor: null })
  })

  it('pages tied timestamps by descending visit ID without duplicates or omissions', () => {
    const first = searchVisits(db, { limit: 2 })
    assert.deepEqual(first.items.map((item) => item.id), [205, 103])
    assert.deepEqual(decodeCursor(first.nextCursor!), [300, 103])
    const second = searchVisits(db, { limit: 2, cursor: first.nextCursor! })
    assert.deepEqual(second.items.map((item) => item.id), [102, 204])
    assert.deepEqual(decodeCursor(second.nextCursor!), [200, 204])
    const third = searchVisits(db, { limit: 2, cursor: second.nextCursor! })
    assert.deepEqual(third.items.map((item) => item.id), [101])
    assert.equal(third.nextCursor, null)
    assert.deepEqual(searchVisits(db, { cursor: encodeCursor(100, 101) }), { items: [], nextCursor: null })
  })

  it('keeps query filters applied across pages and omits cursors on exact-size pages', () => {
    for (const query of ['gu', 'guide']) {
      const first = searchVisits(db, { query, limit: 1 })
      assert.deepEqual(first.items.map((item) => item.id), [103])
      const second = searchVisits(db, { query, limit: 2, cursor: first.nextCursor! })
      assert.deepEqual(second.items.map((item) => item.id), [102, 101])
      assert.equal(second.nextCursor, null)
    }
  })
})

describe('shared search behavior', () => {
  it('ignores malformed cursors', () => {
    for (const find of [search, searchVisits]) {
      for (const cursor of ['', 'bad', 'v2:WzMwMCwxMDNd', 'v1:!', 'v1:e30', 'v1:WzFd', 'v1:WyJhIiwxXQ']) {
        assert.deepEqual(find(db, { cursor, limit: 2 }), find(db, { limit: 2 }))
      }
    }
  })

  it('handles no matches, whitespace queries, and empty databases', () => {
    for (const find of [search, searchVisits]) {
      assert.deepEqual(find(db, { query: 'missing' }), { items: [], nextCursor: null })
      assert.deepEqual(find(db, { query: ' \t ' }), find(db))
    }
    db.exec('DELETE FROM visits; DELETE FROM urls')
    for (const find of [search, searchVisits]) {
      assert.deepEqual(find(db), { items: [], nextCursor: null })
    }
  })

  it('uses default limits and clamps explicit limits', () => {
    for (let id = 1000; id < 1205; id++) {
      db.prepare('INSERT INTO urls (id, url, first_visit_time, last_visit_time, visit_count) VALUES (?, ?, 300, 300, 1)').run(id, `https://limit.test/${id}`)
      db.prepare("INSERT INTO visits (id, url_id, visit_time, transition, source_profile_id, source_visit_id) VALUES (?, ?, 300, 'link', 1, ?)").run(id, id, id)
    }
    for (const find of [search, searchVisits]) {
      assert.equal(find(db, { limit: 0 }).items.length, 1)
      assert.equal(find(db, { limit: 2.9 }).items.length, 2)
      for (const limit of [undefined, NaN, Infinity]) {
        assert.equal(find(db, { limit }).items.length, 50)
      }
      assert.equal(find(db, { limit: 1000 }).items.length, 200)
    }
  })

  for (const field of ['title', 'url'] as const) {
    for (const query of ['xy', 'needle', '%', '_', '\\', '"', 'a"', 'a"b', '100%done', 'under_score', 'path\\value', '\u65e5\u672c', '\u65e5\u672c\u8a9e', '\u{1f600}\u{1f680}', '\u{1f600}\u{1f680}\u{1f30d}']) {
      it(`matches literal ${JSON.stringify(query)} in ${field} using short/long query semantics`, () => {
        const url = field === 'url' ? `https://match.test/${query}/end` : 'https://match.test/plain'
        const title = field === 'title' ? `prefix ${query} suffix` : 'Plain title'
        db.prepare('INSERT INTO urls (id, url, title, first_visit_time, last_visit_time, visit_count) VALUES (40, ?, ?, 600, 600, 12)').run(url, title)
        db.prepare("INSERT INTO visits (id, url_id, visit_time, transition, source_profile_id, source_visit_id) VALUES (406, 40, 600, 'link', 1, 406)").run()
        assert.deepEqual(searchVisits(db, { query: ` ${query} ` }).items.map((item) => item.id), [406])
        assert.deepEqual(search(db, { query }).items.map((item) => item.id), [40])
      })
    }
  }
})

describe('search', () => {
  it('preserves URL search aggregation, lastVisit ranges, cursors, and getVisits', () => {
    assert.deepEqual(search(db).items.map((item) => item.id), [30, 10, 20])
    const first = search(db, { limit: 2 })
    assert.deepEqual(first.items[1], {
      id: 10, url: 'https://example.com/guide', title: 'Example guide', visitCount: 99,
      typedCount: 5, firstVisit: 100, lastVisit: 9000,
    })
    assert.deepEqual(decodeCursor(first.nextCursor!), [9000, 10])
    assert.deepEqual(search(db, { limit: 2, cursor: first.nextCursor! }).items.map((item) => item.id), [20])
    assert.deepEqual(search(db, { from: 200, to: 300 }), { items: [], nextCursor: null })
    assert.deepEqual(search(db, { from: 500, to: 500 }).items.map((item) => item.id), [20])
    assert.deepEqual(search(db, { query: 'guide' }).items.map((item) => item.id), [10])
    assert.deepEqual(getVisits(db, 20), [
      { id: 205, urlId: 20, visitTime: 400, transition: 'typed' },
      { id: 204, urlId: 20, visitTime: 200, transition: 'link' },
    ])
    assert.deepEqual(getVisits(db, 20, 1), [{ id: 205, urlId: 20, visitTime: 400, transition: 'typed' }])
  })
})
