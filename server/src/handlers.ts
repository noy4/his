import type { GithubVisitsFilter, KyselyDb, SearchFilter, SyncOptions, YoutubeItemsFilter } from '@his/core/node'
import { github, history, settings, sources, youtube } from '@his/core/node'
import type { Handler } from './rpc.ts'
import type { SyncRunner } from './sync-runner.ts'

export function createHandlers({ db, runner, home }: {
  db: KyselyDb,
  runner: SyncRunner,
  home: string,
}): Record<string, Handler> {
  const handlers: Record<string, Handler> = {
    'history.search': (params) => history.search(db, params as SearchFilter),
    'history.searchVisits': (params) => history.searchVisits(db, params as SearchFilter),
    'history.getVisits': (params) => history.getVisits(db, params.urlId, params.limit),
    'history.getItem': (params) => history.getItem(db, params.id),
    'history.stats': (params) => history.stats(db, params.month),
    'history.githubStats': (params) => github.stats(db, params.month),
    'history.githubVisits': (params) => github.visits(db, params as GithubVisitsFilter),
    'history.youtubeStats': (params) => youtube.stats(db, params.month),
    'history.youtubeItems': (params) => youtube.items(db, params as YoutubeItemsFilter),
    'sources.list': (params) => sources.list(db, { home, check: params?.check === true }),
    'sync.run': (params) => runner.run(params as SyncOptions),
    'sync.status': () => runner.lastRun(),
    'settings.get': () => settings.get(db),
    'settings.set': (params) => settings.set(db, params),
  }
  return handlers
}
