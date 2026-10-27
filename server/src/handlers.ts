import type { GithubItemsFilter, KyselyDb, SearchFilter, SyncOptions, YoutubeItemsFilter } from '@his/core/node'
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
    'history.stats': (params) => history.stats(db, params.month),
    'history.githubStats': (params) => github.stats(db, params.month),
    'history.githubItems': (params) => github.items(db, params as GithubItemsFilter),
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
