import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { before, describe, it } from 'node:test'
import { createDb, migrate } from '../../../db/db.ts'
import { sourceProfile, seedUrl } from '../../../testing/db.ts'
import { youtubeStats } from '../youtube.ts'

const at = (iso: string) => new Date(iso).getTime()

const handle = new DatabaseSync(':memory:')
const db = createDb(handle)

before(async () => {
  await migrate(handle)
  await db.insertInto('source_profiles').values(sourceProfile).execute()
  await seedUrl(db, { id: 1, url: 'https://www.youtube.com/watch?v=a', title: 'A - YouTube', times: [at('2026-10-10T10:00')] })
  await seedUrl(db, { id: 2, url: 'https://www.youtube.com/watch?v=a&themeRefresh=1', title: 'A better title - YouTube', times: [at('2026-10-10T12:00')] })
  await seedUrl(db, { id: 3, url: 'https://www.youtube.com/shorts/b', title: 'B #shorts - YouTube', times: [at('2026-10-10T11:00')] })
  await seedUrl(db, { id: 4, url: 'https://www.youtube.com/@chan', title: 'Chan - YouTube', times: [at('2026-10-10T09:00')] })
  await seedUrl(db, { id: 5, url: 'https://www.youtube.com/results?search_query=x', title: 'x - YouTube', times: [at('2026-10-10T08:00')] })
  await seedUrl(db, { id: 6, url: 'https://www.youtube.com/channel/UC9', title: 'UC9 - YouTube', times: [at('2026-10-09T10:00')] })
})

describe('youtubeStats.byDayTop', () => {
  it('counts distinct items per kind', async () => {
    const { kindCounts } = await youtubeStats(db)
    assert.deepEqual(kindCounts, { all: 5, video: 1, shorts: 1, channel: 2, playlist: 0, search: 1, other: 0 })
  })

  it('splits video / shorts / other and merges URL variants per day', async () => {
    const { byDay, byDayTop } = await youtubeStats(db)
    assert.deepEqual(byDay.find((d) => d.day === '2026-10-10'), { day: '2026-10-10', all: 5, video: 2, shorts: 1, other: 2 })

    const day = byDayTop.find((d) => d.day === '2026-10-10')
    assert.deepEqual(day?.video, [{
      key: 'video:a',
      kind: 'video',
      id: 'a',
      title: 'A better title - YouTube',
      url: 'https://www.youtube.com/watch?v=a&themeRefresh=1',
      visits: 2,
      lastVisit: at('2026-10-10T12:00'),
    }])
    assert.deepEqual(day?.shorts.map((i) => `${i.kind}:${i.id}:${i.visits}`), ['shorts:b:1'])
    // other: most recently visited first (channel before the search page)
    assert.deepEqual(day?.other.map((i) => i.kind), ['channel', 'search'])
    assert.equal(day?.other[0]?.key, 'channel:@chan')
  })

  it('caps each kind at the most recent three', async () => {
    const h = new DatabaseSync(':memory:')
    try {
      await migrate(h)
      const tdb = createDb(h)
      await tdb.insertInto('source_profiles').values(sourceProfile).execute()
      const times = ['10:00', '11:00', '12:00', '13:00']
      for (const [i, t] of times.entries()) {
        await seedUrl(tdb, { id: i + 1, url: `https://www.youtube.com/watch?v=v${i}`, title: `V${i}`, times: [at(`2026-10-10T${t}`)] })
      }
      const [day] = (await youtubeStats(tdb)).byDayTop
      assert.deepEqual(day?.video.map((i) => i.id), ['v3', 'v2', 'v1'])
    } finally {
      h.close()
    }
  })
})
