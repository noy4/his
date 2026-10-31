import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseSearchQuery } from '../parse.ts'

describe('parseSearchQuery', () => {
  const cases: [string, ReturnType<typeof parseSearchQuery>][] = [
    // google
    ['https://www.google.com/search?q=typescript+generics', { engine: 'google', term: 'typescript generics' }],
    ['https://google.com/search?q=hi', { engine: 'google', term: 'hi' }],
    ['https://WWW.GOOGLE.COM/search?q=hi', { engine: 'google', term: 'hi' }],
    ['https://www.google.com/search?hl=en&q=hi', { engine: 'google', term: 'hi' }],
    ['https://www.google.com/search?hl=en', null],
    ['https://www.google.com/maps?q=hi', null],
    // bing
    ['https://www.bing.com/search?q=css+grid', { engine: 'bing', term: 'css grid' }],
    ['https://bing.com/search?q=x', { engine: 'bing', term: 'x' }],
    ['https://www.bing.com/maps?q=x', null],
    // duckduckgo
    ['https://duckduckgo.com/?q=sqlite', { engine: 'duckduckgo', term: 'sqlite' }],
    ['https://duckduckgo.com/html/?q=sqlite', { engine: 'duckduckgo', term: 'sqlite' }],
    // brave
    ['https://search.brave.com/search?q=preact+signals', { engine: 'brave', term: 'preact signals' }],
    ['https://search.brave.com/search?source=web&q=x', { engine: 'brave', term: 'x' }],
    ['https://brave.com/search?q=x', null],
    // normalization
    ['https://www.google.com/search?q=%20a%20%20b%20', { engine: 'google', term: 'a b' }],
    ['https://www.google.com/search?q=caf%C3%A9%20au%20lait', { engine: 'google', term: 'café au lait' }],
    ['https://www.google.com/search?q=', null],
    ['https://www.google.com/search?q=%20%20', null],
    // other
    ['https://example.com/search?q=x', null],
    ['not a url', null],
  ]
  for (const [url, want] of cases) {
    it(url, () => assert.deepEqual(parseSearchQuery(url), want))
  }
})
