import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { describe, it } from 'node:test'
import { migrate } from '../db.ts'
import { search } from '../query.ts'
import { cleanPatterns, getSettings, matchesHidden, recomputeHidden, setSettings } from '../../settings.ts'

function insertUrl(db: DatabaseSync, id: number, url: string, lastVisit: number): void {
  db.prepare(
    'INSERT INTO urls (id, url, title, visit_count, typed_count, first_visit_time, last_visit_time) VALUES (?, ?, ?, 1, 0, ?, ?)',
  ).run(id, url, url, lastVisit, lastVisit)
}

describe('cleanPatterns', () => {
  it('trims, lowercases, drops empties and dedupes', () => {
    assert.deepEqual(cleanPatterns([' Example.com ', 'example.com', '', '   ', 42, '10.0.*']), [
      'example.com',
      '10.0.*',
    ])
  })

  it('rejects non-arrays', () => {
    assert.deepEqual(cleanPatterns('nope'), [])
    assert.deepEqual(cleanPatterns(undefined), [])
  })

  it('caps at 500 patterns', () => {
    const many = Array.from({ length: 600 }, (_, i) => `h${i}.com`)
    assert.equal(cleanPatterns(many).length, 500)
  })
})

describe('matchesHidden', () => {
  it('matches a bare domain and its subdomains, case-insensitively', () => {
    assert.equal(matchesHidden('https://example.com/a', ['example.com']), true)
    assert.equal(matchesHidden('https://www.example.com/a', ['example.com']), true)
    assert.equal(matchesHidden('https://EXAMPLE.com/a', ['example.com']), true)
    assert.equal(matchesHidden('https://notexample.com/a', ['example.com']), false)
  })

  it('matches a wildcard host', () => {
    assert.equal(matchesHidden('http://10.0.5.2/x', ['10.0.*']), true)
    assert.equal(matchesHidden('http://10.1.5.2/x', ['10.0.*']), false)
  })

  it('matches a URL glob when the pattern has a slash', () => {
    assert.equal(matchesHidden('https://github.com/o/r/pull/12', ['github.com/*/pull/*']), true)
    assert.equal(matchesHidden('https://github.com/o/r/issues/12', ['github.com/*/pull/*']), false)
  })

  it('never matches with no patterns', () => {
    assert.equal(matchesHidden('https://example.com/a', []), false)
  })
})

describe('settings + recompute', () => {
  it('stores patterns, materializes hidden_urls and excludes them from search', async () => {
    const db = new DatabaseSync(':memory:')
    try {
      await migrate(db)
      insertUrl(db, 1, 'https://example.com/a', 1000)
      insertUrl(db, 2, 'https://news.example.com/b', 2000)
      insertUrl(db, 3, 'https://other.com/c', 3000)

      const info = setSettings(db, ['Example.com'])
      assert.deepEqual(info.hiddenPatterns, ['example.com'])
      assert.equal(info.hiddenCount, 2)

      assert.deepEqual(getSettings(db).hiddenPatterns, ['example.com'])
      assert.equal(getSettings(db).hiddenCount, 2)

      assert.deepEqual(search(db, {}).items.map((item) => item.url), ['https://other.com/c'])
    } finally {
      db.close()
    }
  })

  it('unhides everything when patterns are cleared', async () => {
    const db = new DatabaseSync(':memory:')
    try {
      await migrate(db)
      insertUrl(db, 1, 'https://example.com/a', 1000)
      insertUrl(db, 2, 'https://other.com/c', 2000)

      setSettings(db, ['example.com'])
      assert.equal(search(db, {}).items.length, 1)

      const info = setSettings(db, [])
      assert.equal(info.hiddenCount, 0)
      assert.equal(search(db, {}).items.length, 2)
    } finally {
      db.close()
    }
  })

  it('recomputeHidden only counts changed rows', async () => {
    const db = new DatabaseSync(':memory:')
    try {
      await migrate(db)
      insertUrl(db, 1, 'https://example.com/a', 1000)
      insertUrl(db, 2, 'https://news.example.com/b', 2000)
      insertUrl(db, 3, 'https://other.com/c', 3000)

      setSettings(db, ['example.com'])
      assert.equal(recomputeHidden(db, ['example.com']), 0)
      // remove 2 (example, news) + add 1 (other) = 3
      assert.equal(recomputeHidden(db, ['other.com']), 3)
    } finally {
      db.close()
    }
  })
})
