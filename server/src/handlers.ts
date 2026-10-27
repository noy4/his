import type { GithubSearchParams, KyselyDb, SearchParams, SyncOptions, YoutubeSearchParams } from '@his/core/node'
import { github, history, settings, sources, youtube } from '@his/core/node'
import type { Handler } from './rpc.ts'
import type { SyncRunner } from './sync-runner.ts'

export function createHandlers({ db, runner, home }: {
  db: KyselyDb,
  runner: SyncRunner,
  home: string,
}): Record<string, Handler> {
  const handlers: Record<string, Handler> = {
    'history.search': (params) => history.search(db, params as SearchParams),
    'history.searchVisits': (params) => history.searchVisits(db, params as SearchParams),
    'history.stats': (params) => history.stats(db, params),

    'github.stats': (params) => github.stats(db, params),
    'github.search': (params) => github.search(db, params as GithubSearchParams),

    'youtube.stats': (params) => youtube.stats(db, params),
    'youtube.search': (params) => youtube.search(db, params as YoutubeSearchParams),

    'sources.list': (params) => sources.list(db, { home, check: params?.check === true }),

    'sync.run': (params) => runner.run(params as SyncOptions),
    'sync.status': () => runner.lastRun(),

    'settings.get': () => settings.get(db),
    'settings.set': (params) => settings.set(db, params),
  }
  return handlers
}
