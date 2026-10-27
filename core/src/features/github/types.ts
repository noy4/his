import type { EpochMs } from '../../types.ts'

// Browser-safe GitHub data types (no DB/Node imports). Functions live in github.ts / parse.ts.

export type GithubKind = 'pull' | 'issue'
// 'repo' = repo root only
// 'issue_pr' = single PR/Issue
// 'other' = owner pages and repo pages without root / PR / Issue
export type GithubVisitKind = 'all' | 'repo' | 'issue_pr' | 'other'

/** kinds that can be charted per day ('all' is the row total) */
export type GithubDayKind = Exclude<GithubVisitKind, 'all'>

export interface GithubDayItem {
  key: string
  kind: GithubDayKind
  owner: string
  repo?: string
  number?: number
  pullKind?: GithubKind
  visits: number
  lastVisit: EpochMs
}

export interface GithubStats {
  totals: {
    visits: number
    repos: number
    owners: number
    items: number
    firstVisit: EpochMs
    lastVisit: EpochMs
  }
  byDay: {
    day: string
    all: number
    repo: number
    issue_pr: number
    other: number
  }[]
  byDayTop: {
    day: string
    repo: GithubDayItem[]
    issue_pr: GithubDayItem[]
    other: GithubDayItem[]
  }[]
  topRepos: { owner: string; repo: string; visits: number }[]
  topOwners: { owner: string; repos: number; visits: number }[]
  topItems: {
    owner: string
    repo: string
    kind: GithubKind
    number: number
    title: string
    url: string
    visits: number
  }[]
}

export interface GithubSearchParams {
  month?: string
  owner?: string
  repo?: string
  kind?: GithubVisitKind
  cursor?: string
  limit?: number
}
