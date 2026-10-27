import type { GithubSearchFilter, KyselyDb, SearchFilter, SyncOptions, YoutubeSearchFilter } from '@his/core/node'
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
    'history.stats': (params) => history.stats(db, params),

    'github.stats': (params) => github.stats(db, params),
    'github.search': (params) => github.search(db, params as GithubSearchFilter),

    'youtube.stats': (params) => youtube.stats(db, params),
    'youtube.search': (params) => youtube.search(db, params as YoutubeSearchFilter),

    'sources.list': (params) => sources.list(db, { home, check: params?.check === true }),

    'sync.run': (params) => runner.run(params as SyncOptions),
    'sync.status': () => runner.lastRun(),

    'settings.get': () => settings.get(db),
    'settings.set': (params) => settings.set(db, params),
  }
  return handlers
}
