import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mergeYoutubeRows, parseYoutubeUrl, youtubeItemKey } from '../parse.ts'

describe('parseYoutubeUrl', () => {
  const cases: [string, ReturnType<typeof parseYoutubeUrl>][] = [
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', { kind: 'video', id: 'dQw4w9WgXcQ' }],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1s', { kind: 'video', id: 'dQw4w9WgXcQ' }],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&themeRefresh=1', { kind: 'video', id: 'dQw4w9WgXcQ' }],
    ['https://youtu.be/dQw4w9WgXcQ?themeRefresh=1', { kind: 'video', id: 'dQw4w9WgXcQ' }],
    ['https://m.youtube.com/watch?v=abc', { kind: 'video', id: 'abc' }],
    ['https://www.youtube.com/shorts/abc', { kind: 'video', id: 'abc', shorts: true }],
    ['https://www.youtube.com/embed/abc', { kind: 'video', id: 'abc' }],
    ['https://www.youtube.com/playlist?list=PL123', { kind: 'playlist', id: 'PL123' }],
    ['https://www.youtube.com/@channel', { kind: 'channel', id: '@channel' }],
    ['https://www.youtube.com/channel/UC123', { kind: 'channel', id: 'UC123' }],
    ['https://www.youtube.com/results?search_query=x', { search: true }],
    ['https://www.youtube.com/', {}],
    ['https://example.com/watch?v=abc', null],
    ['not a url', null],
  ]
  for (const [url, want] of cases) {
    it(url, () => assert.deepEqual(parseYoutubeUrl(url), want))
  }
})

describe('youtubeItemKey', () => {
  it('ignores query-only differences for entities', () => {
    assert.equal(
      youtubeItemKey({ kind: 'video', id: 'abc' }, 'https://www.youtube.com/watch?v=abc'),
      youtubeItemKey({ kind: 'video', id: 'abc' }, 'https://www.youtube.com/watch?v=abc&themeRefresh=1'),
    )
  })
  it('keys entity-less pages by full url', () => {
    const home = youtubeItemKey({}, 'https://www.youtube.com/')
    const results = youtubeItemKey({}, 'https://www.youtube.com/results?search_query=x')
    assert.notEqual(home, results)
  })
  it('ignores noise params / trailing slash / hash on entity-less pages', () => {
    const base = youtubeItemKey({}, 'https://www.youtube.com')
    assert.equal(base, youtubeItemKey({}, 'https://www.youtube.com/'))
    assert.equal(base, youtubeItemKey({}, 'https://www.youtube.com/?themeRefresh=1'))
    assert.notEqual(
      youtubeItemKey({}, 'https://www.youtube.com/results?search_query=x'),
      youtubeItemKey({}, 'https://www.youtube.com/results?search_query=y'),
    )
  })
})

describe('mergeYoutubeRows', () => {
  const row = (id: number, url: string, lastVisit: number, visitCount = 1) => ({
    item: { id, url, title: `t${id}`, visitCount, typedCount: 0, firstVisit: lastVisit, lastVisit },
    urlInfo: parseYoutubeUrl(url)!,
  })

  it('collapses ?themeRefresh variants into one item', () => {
    const out = mergeYoutubeRows([
      row(1, 'https://www.youtube.com/watch?v=abc', 10, 3),
      row(2, 'https://www.youtube.com/watch?v=abc&themeRefresh=1', 30, 2),
    ])
    assert.deepEqual(out.map((r) => r.item), [
      {
        id: 2,
        url: 'https://www.youtube.com/watch?v=abc&themeRefresh=1',
        title: 't2',
        visitCount: 5,
        typedCount: 0,
        firstVisit: 10,
        lastVisit: 30,
      },
    ])
  })

  it('keeps distinct videos and entity-less pages apart', () => {
    const out = mergeYoutubeRows([
      row(1, 'https://www.youtube.com/watch?v=a', 10),
      row(2, 'https://www.youtube.com/watch?v=b', 20),
      row(3, 'https://www.youtube.com/', 30),
      row(4, 'https://www.youtube.com/results?search_query=x', 40),
    ])
    assert.deepEqual(out.map((r) => r.item.id), [1, 2, 3, 4])
  })

  it('collapses home page with noise param', () => {
    const out = mergeYoutubeRows([
      row(1, 'https://www.youtube.com', 10),
      row(2, 'https://www.youtube.com/?themeRefresh=1', 20),
    ])
    assert.equal(out.length, 1)
    assert.equal(out[0]!.item.visitCount, 2)
  })

  it('unions shorts across variants', () => {
    const out = mergeYoutubeRows([
      row(1, 'https://www.youtube.com/watch?v=abc', 10),
      row(2, 'https://www.youtube.com/shorts/abc', 20),
    ])
    assert.equal(out.length, 1)
    assert.equal(out[0]!.urlInfo.shorts, true)
    assert.equal(out[0]!.item.visitCount, 2)
  })
})
