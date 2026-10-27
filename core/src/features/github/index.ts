// GitHub feature façade. Public names drop the redundant `github` prefix.
export { githubItems as items, githubStats as stats } from './github.ts'
export type { GithubDayItem, GithubDayKind, GithubItemsFilter, GithubStats } from './types.ts'
export * from './parse.ts'
