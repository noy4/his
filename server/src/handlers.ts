import type { GithubVisitsFilter, KyselyDb, SearchFilter, SyncOptions } from '@his/core/node'
import { github, history, listSourceProfiles, settings } from '@his/core/node'
import type { Handler } from './rpc.ts'
import type { SyncRunner } from './sync-runner.ts'

export function createHandlers({ db, runner }: {
  db: KyselyDb,
  runner: SyncRunner,
}): Record<string, Handler> {
  const handlers: Record<string, Handler> = {
    'history.search': (params) => history.search(db, params as SearchFilter),
    'history.searchVisits': (params) => history.searchVisits(db, params as SearchFilter),
    'history.getVisits': (params) => history.getVisits(db, params.urlId, params.limit),
    'history.getItem': (params) => history.getItem(db, params.id),
    'history.stats': (params) => history.stats(db, params.month),
    'history.githubStats': (params) => github.stats(db, params.month),
    'history.githubVisits': (params) => github.visits(db, params as GithubVisitsFilter),
    'sources.list': (params) => listSourceProfiles(db, { check: params?.check === true }),
    'sync.run': (params) => runner.run(params as SyncOptions),
    'sync.status': () => runner.lastRun(),
    'settings.get': () => settings.get(db),
    'settings.set': (params) => settings.set(db, params.hiddenPatterns),
  }
  return handlers
}
