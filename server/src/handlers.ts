import type { KyselyDb, SearchFilter, SyncOptions } from '@his/core/node'
import {
  getItem,
  github,
  getVisits,
  listSourceProfiles,
  search,
  searchVisits,
  settings,
  stats,
} from '@his/core/node'
import type { Handler } from './rpc.ts'
import type { SyncRunner } from './sync-runner.ts'

export function createHandlers({ db, runner }: {
  db: KyselyDb,
  runner: SyncRunner,
}): Record<string, Handler> {
  const handlers: Record<string, Handler> = {
    'history.search': (params) => search(db, params as SearchFilter),
    'history.searchVisits': (params) => searchVisits(db, params as SearchFilter),
    'history.getVisits': (params) => getVisits(db, params.urlId, params.limit),
    'history.getItem': (params) => getItem(db, params.id),
    'history.stats': (params) => stats(db, params.month),
    'history.githubStats': (params) => github.stats(db, params.month),
    'history.githubVisits': (params) => github.visits(db, params as github.GithubVisitsFilter),
    'sources.list': (params) => listSourceProfiles(db, { check: params?.check === true }),
    'sync.run': (params) => runner.run(params as SyncOptions),
    'sync.status': () => runner.lastRun(),
    'settings.get': () => settings.getSettings(db),
    'settings.set': (params) => settings.setSettings(db, params.hiddenPatterns),
  }
  return handlers
}
