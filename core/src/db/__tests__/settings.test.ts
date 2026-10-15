import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { createDb, migrate, type KyselyDb } from '../db.ts'
import { search } from '../query.ts'
import { cleanPatterns, getSettings, matchesHidden, recomputeHidden, setSettings } from '../../features/settings.ts'

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
  let handle: DatabaseSync
  let db: KyselyDb

  beforeEach(async () => {
    handle = new DatabaseSync(':memory:')
    await migrate(handle)
    db = createDb(handle)
  })

  afterEach(() => handle.close())

  async function insertUrl(id: number, url: string, lastVisit: number): Promise<void> {
    await db
      .insertInto('urls')
      .values({
        id,
        url,
        title: url,
        visit_count: 1,
        typed_count: 0,
        first_visit_time: lastVisit,
        last_visit_time: lastVisit,
      })
      .execute()
  }

  it('stores patterns, materializes hidden_urls and excludes them from search', async () => {
    await insertUrl(1, 'https://example.com/a', 1000)
    await insertUrl(2, 'https://news.example.com/b', 2000)
    await insertUrl(3, 'https://other.com/c', 3000)

    const info = await setSettings(db, ['Example.com'])
    assert.deepEqual(info.hiddenPatterns, ['example.com'])
    assert.equal(info.hiddenCount, 2)

    assert.deepEqual((await getSettings(db)).hiddenPatterns, ['example.com'])
    assert.equal((await getSettings(db)).hiddenCount, 2)

    assert.deepEqual((await search(db, {})).items.map((item) => item.url), ['https://other.com/c'])
  })

  it('unhides everything when patterns are cleared', async () => {
    await insertUrl(1, 'https://example.com/a', 1000)
    await insertUrl(2, 'https://other.com/c', 2000)

    await setSettings(db, ['example.com'])
    assert.equal((await search(db, {})).items.length, 1)

    const info = await setSettings(db, [])
    assert.equal(info.hiddenCount, 0)
    assert.equal((await search(db, {})).items.length, 2)
  })

  it('recomputeHidden only counts changed rows', async () => {
    await insertUrl(1, 'https://example.com/a', 1000)
    await insertUrl(2, 'https://news.example.com/b', 2000)
    await insertUrl(3, 'https://other.com/c', 3000)

    await setSettings(db, ['example.com'])
    assert.equal(await recomputeHidden(db, ['example.com']), 0)
    // remove 2 (example, news) + add 1 (other) = 3
    assert.equal(await recomputeHidden(db, ['other.com']), 3)
  })
})
