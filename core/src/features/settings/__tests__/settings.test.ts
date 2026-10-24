import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { createDb, migrate, type KyselyDb } from '../../../db/db.ts'
import { search } from '../../history/query.ts'
import { recomputeHidden } from '../hidden.ts'
import { getSettings, setSettings } from '../settings.ts'

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

    const info = await setSettings(db, { hiddenPatterns: ['Example.com'] })
    assert.deepEqual(info.hiddenPatterns, ['example.com'])
    assert.equal(info.hiddenUrlCount, 2)

    assert.deepEqual((await getSettings(db)).hiddenPatterns, ['example.com'])
    assert.equal((await getSettings(db)).hiddenUrlCount, 2)

    assert.deepEqual((await search(db, {})).items.map((item) => item.url), ['https://other.com/c'])
  })

  it('unhides everything when patterns are cleared', async () => {
    await insertUrl(1, 'https://example.com/a', 1000)
    await insertUrl(2, 'https://other.com/c', 2000)

    await setSettings(db, { hiddenPatterns: ['example.com'] })
    assert.equal((await search(db, {})).items.length, 1)

    const info = await setSettings(db, { hiddenPatterns: [] })
    assert.equal(info.hiddenUrlCount, 0)
    assert.equal((await search(db, {})).items.length, 2)
  })

  it('recomputeHidden only counts changed rows', async () => {
    await insertUrl(1, 'https://example.com/a', 1000)
    await insertUrl(2, 'https://news.example.com/b', 2000)
    await insertUrl(3, 'https://other.com/c', 3000)

    await setSettings(db, { hiddenPatterns: ['example.com'] })
    assert.equal(await recomputeHidden(db, ['example.com']), 0)
    // remove 2 (example, news) + add 1 (other) = 3
    assert.equal(await recomputeHidden(db, ['other.com']), 3)
  })

  it('stores sync targets and keeps them when hidden patterns change', async () => {
    await insertUrl(1, 'https://example.com/a', 1000)

    await setSettings(db, { hiddenPatterns: ['example.com'] })
    const info = await setSettings(db, { syncTargets: ['Chrome:Default', 'bad'] })
    assert.deepEqual(info.syncTargets, ['chrome:Default', 'bad'])

    const after = await setSettings(db, { hiddenPatterns: [] })
    assert.deepEqual(after.syncTargets, ['chrome:Default', 'bad'])
    assert.equal(after.hiddenUrlCount, 0)
  })
})
