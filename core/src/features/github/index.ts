// GitHub feature façade. Public names drop the redundant `github` prefix.
export { githubStats as stats, githubVisits as visits } from './github.ts'
export type { GithubStats, GithubDayItem, GithubDayKind, GithubVisitsFilter } from './types.ts'
export * from './parse.ts'
