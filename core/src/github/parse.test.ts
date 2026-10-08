import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { matchesKind, mergeRepoRoots, parseGithubTitle, parseGithubUrl } from './parse.ts'

describe('parseGithubUrl', () => {
  const cases: [string, ReturnType<typeof parseGithubUrl>][] = [
    ['https://github.com/Foo', { owner: 'foo' }],
    ['https://github.com/Foo/', { owner: 'foo' }],
    ['https://github.com/Foo/Bar', { owner: 'foo', repo: 'bar', root: true }],
    ['https://github.com/Foo/Bar/?tab=readme#x', { owner: 'foo', repo: 'bar', root: true }],
    ['https://www.github.com/foo/bar', { owner: 'foo', repo: 'bar', root: true }],
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

describe('mergeRepoRoots', () => {
  const row = (id: number, url: string, lastVisit: number) => ({
    item: { id, url, title: `t${id}`, visitCount: 1, typedCount: 0, firstVisit: lastVisit, lastVisit },
    ref: parseGithubUrl(url)!,
  })

  it('collapses root variants, keeps other pages', () => {
    const out = mergeRepoRoots([
      row(1, 'https://github.com/Foo/Bar', 10),
      row(2, 'https://github.com/foo/bar?tab=MIT-1-ov-file', 30),
      row(3, 'https://github.com/foo/bar#readme', 20),
      row(4, 'https://github.com/foo/bar/issues/1', 40),
    ])
    assert.deepEqual(out.map((r) => r.item), [
      { id: 4, url: 'https://github.com/foo/bar/issues/1', title: 't4', visitCount: 1, typedCount: 0, firstVisit: 40, lastVisit: 40 },
      { id: 2, url: 'https://github.com/foo/bar', title: 't2', visitCount: 3, typedCount: 0, firstVisit: 10, lastVisit: 30 },
    ])
  })
})

describe('matchesKind', () => {
  const owner = { owner: 'foo' }
  const root = { owner: 'foo', repo: 'bar', root: true } as const
  const page = { owner: 'foo', repo: 'bar' }
  const pull = { owner: 'foo', repo: 'bar', kind: 'pull', number: 1 } as const
  const issue = { owner: 'foo', repo: 'bar', kind: 'issue', number: 1 } as const
  const all = [owner, root, page, pull, issue]

  it('all matches everything', () => {
    for (const r of all) assert.equal(matchesKind(r, 'all'), true)
  })
  it('repo = repo root only', () => {
    assert.deepEqual(all.map((r) => matchesKind(r, 'repo')), [false, true, false, false, false])
  })
  it('code = repo pages without root / PR / Issue', () => {
    assert.deepEqual(all.map((r) => matchesKind(r, 'code')), [false, false, true, false, false])
  })
  it('issue_pr = PR + Issue', () => {
    assert.deepEqual(all.map((r) => matchesKind(r, 'issue_pr')), [false, false, false, true, true])
  })
})

describe('parseGithubTitle', () => {
  const root = { owner: 'o', repo: 'r', root: true } as const
  it('repo with desc', () => {
    assert.deepEqual(parseGithubTitle('o/r: A tool: fast', root), { name: 'r', desc: 'A tool: fast' })
  })
  it('repo without desc', () => {
    assert.deepEqual(parseGithubTitle('o/r', root), { name: 'r', desc: undefined })
  })
  it('repo odd title', () => {
    assert.deepEqual(parseGithubTitle('GitHub - something', root), { name: 'r' })
  })
  it('pull', () => {
    assert.deepEqual(parseGithubTitle('Fix X by alice · Pull Request #12 · o/r', { owner: 'o', repo: 'r', kind: 'pull', number: 12 }), { name: 'Fix X', meta: 'alice' })
  })
  it('issue', () => {
    assert.deepEqual(parseGithubTitle('Bug Y · Issue #3 · o/r', { owner: 'o', repo: 'r', kind: 'issue', number: 3 }), { name: 'Bug Y', meta: undefined })
  })
  it('empty', () => {
    assert.equal(parseGithubTitle('', { owner: 'o', repo: 'r', kind: 'issue', number: 3 }).name, '')
  })
})
