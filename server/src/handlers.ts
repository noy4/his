import type { KyselyDb } from '@his/core/node'
import { github, history, settings, sources, youtube } from '@his/core/node'
import type { Handler } from './rpc.ts'
import type { SyncRunner } from './sync-runner.ts'

export function createHandlers({ db, runner, home }: {
  db: KyselyDb,
  runner: SyncRunner,
  home: string,
}): Record<string, Handler> {
  const handlers: Record<string, Handler> = {
    'history.search': (params) => history.search(db, params),
    'history.searchVisits': (params) => history.searchVisits(db, params),
    'history.stats': (params) => history.stats(db, params),

    'github.stats': (params) => github.stats(db, params),
    'github.search': (params) => github.search(db, params),

    'youtube.stats': (params) => youtube.stats(db, params),
    'youtube.search': (params) => youtube.search(db, params),

    'sources.list': () => sources.list(db, { home }),

    'sync.run': (params) => runner.run(params),
    'sync.status': () => runner.lastRun(),

    'settings.get': () => settings.get(db),
    'settings.set': (params) => settings.set(db, params),
  }
  return handlers
}
