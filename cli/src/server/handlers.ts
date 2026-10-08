import type { DatabaseSync } from 'node:sqlite'
import type { GithubVisitsFilter, SearchFilter, SyncOptions } from '@his/core'
import {
  getItem,
  githubStats,
  githubVisits,
  getVisits,
  listSourceProfiles,
  search,
  stats,
} from '@his/core'
import type { Handler } from './rpc.ts'
import type { SyncRunner } from './sync-runner.ts'

export function createHandlers({ db, runner }: {
  db: DatabaseSync,
  runner: SyncRunner,
}): Record<string, Handler> {
  const handlers: Record<string, Handler> = {
    'history.search': (params) => search(db, params as SearchFilter),
    'history.getVisits': (params) => getVisits(db, params.urlId, params.limit),
    'history.getItem': (params) => getItem(db, params.id),
    'history.stats': (params) => stats(db, params.month),
    'history.githubStats': (params) => githubStats(db, params.month),
    'history.githubVisits': (params) => githubVisits(db, params as GithubVisitsFilter),
    'sources.list': () => listSourceProfiles(db),
    'sync.run': (params) => runner.run(params as SyncOptions),
    'sync.status': () => runner.lastRun(),
  }
  return handlers
}
