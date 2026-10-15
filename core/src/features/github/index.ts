// GitHub feature façade. Public names drop the redundant `github` prefix.
export { githubStats as stats, githubVisits as visits, type GithubStats, type GithubVisitsFilter } from './stats.ts'
export * from './parse.ts'
