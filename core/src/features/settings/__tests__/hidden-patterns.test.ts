import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { cleanPatterns, matchesHidden } from '../hidden-patterns.ts'

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
