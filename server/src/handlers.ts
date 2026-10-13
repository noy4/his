import type { DatabaseSync } from 'node:sqlite'
import type { GithubVisitsFilter, SearchFilter, SyncOptions } from '@his/core/node'
import {
  getItem,
  getSettings,
  githubStats,
  githubVisits,
  getVisits,
  listSourceProfiles,
  search,
  searchVisits,
  setSettings,
  stats,
} from '@his/core/node'
import type { Handler } from './rpc.ts'
import type { SyncRunner } from './sync-runner.ts'

export function createHandlers({ db, runner }: {
  db: DatabaseSync,
  runner: SyncRunner,
}): Record<string, Handler> {
  const handlers: Record<string, Handler> = {
    'history.search': (params) => search(db, params as SearchFilter),
    'history.searchVisits': (params) => searchVisits(db, params as SearchFilter),
    'history.getVisits': (params) => getVisits(db, params.urlId, params.limit),
    'history.getItem': (params) => getItem(db, params.id),
    'history.stats': (params) => stats(db, params.month),
    'history.githubStats': (params) => githubStats(db, params.month),
    'history.githubVisits': (params) => githubVisits(db, params as GithubVisitsFilter),
    'sources.list': (params) => listSourceProfiles(db, { check: params?.check === true }),
    'sync.run': (params) => runner.run(params as SyncOptions),
    'sync.status': () => runner.lastRun(),
    'settings.get': () => getSettings(db),
    'settings.set': (params) => setSettings(db, params.hiddenPatterns),
  }
  return handlers
}
