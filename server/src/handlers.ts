import type { KyselyDb } from '@his/core/node'
import { history, settings, sources } from '@his/core/node'
import { PLUGINS } from './plugins/index.ts'
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

    'sources.list': () => sources.list(db, { home }),

    'sync.run': (params) => runner.run(params),
    'sync.status': () => runner.lastSummary,

    'settings.get': () => settings.get(db),
    'settings.set': (params) => settings.set(db, params),
  }

  for (const plugin of PLUGINS) {
    Object.assign(handlers, plugin.handlers({ db }))
  }

  return handlers
}
