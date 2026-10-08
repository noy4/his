import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { matchesKind, parseGithubUrl } from './parse.ts'

describe('parseGithubUrl', () => {
  const cases: [string, ReturnType<typeof parseGithubUrl>][] = [
    ['https://github.com/Foo', { owner: 'foo' }],
    ['https://github.com/Foo/', { owner: 'foo' }],
    ['https://github.com/Foo/Bar', { owner: 'foo', repo: 'bar' }],
    ['https://www.github.com/foo/bar', { owner: 'foo', repo: 'bar' }],
    ['https://github.com/foo/bar/tree/main/src', { owner: 'foo', repo: 'bar' }],
    ['https://github.com/foo/bar/pulls', { owner: 'foo', repo: 'bar' }],
    ['https://github.com/foo/bar/issues', { owner: 'foo', repo: 'bar' }],
    ['https://github.com/foo/bar/pull/12', { owner: 'foo', repo: 'bar', kind: 'pull', number: 12 }],
    ['https://github.com/foo/bar/pull/12/files', { owner: 'foo', repo: 'bar', kind: 'pull', number: 12 }],
    ['https://github.com/foo/bar/issues/7', { owner: 'foo', repo: 'bar', kind: 'issue', number: 7 }],
    ['https://github.com/foo/bar/issues/7?q=1#issuecomment-9', { owner: 'foo', repo: 'bar', kind: 'issue', number: 7 }],
    ['https://github.com/foo/bar/pull/abc', { owner: 'foo', repo: 'bar' }],
    ['https://github.com/foo/bar/actions/runs/123', { owner: 'foo', repo: 'bar' }],
    ['https://github.com/settings/profile', null],
    ['https://github.com/notifications', null],
    ['https://github.com/orgs/foo/people', null],
    ['https://github.com/search?q=x', null],
    ['https://github.com/pulls', null],
    ['https://github.com/', null],
    ['https://gist.github.com/foo/abc', null],
    ['https://example.com/foo/bar', null],
    ['not a url', null],
  ]
  for (const [url, want] of cases) {
    it(url, () => assert.deepEqual(parseGithubUrl(url), want))
  }
})

describe('matchesKind', () => {
  const owner = { owner: 'foo' }
  const repo = { owner: 'foo', repo: 'bar' }
  const pull = { owner: 'foo', repo: 'bar', kind: 'pull', number: 1 } as const
  const issue = { owner: 'foo', repo: 'bar', kind: 'issue', number: 1 } as const

  it('all matches everything', () => {
    for (const r of [owner, repo, pull, issue]) assert.equal(matchesKind(r, 'all'), true)
  })
  it('code = repo pages without PR/Issue', () => {
    assert.deepEqual([owner, repo, pull, issue].map((r) => matchesKind(r, 'code')), [false, true, false, false])
  })
  it('pull / issue', () => {
    assert.deepEqual([owner, repo, pull, issue].map((r) => matchesKind(r, 'pull')), [false, false, true, false])
    assert.deepEqual([owner, repo, pull, issue].map((r) => matchesKind(r, 'issue')), [false, false, false, true])
  })
})
