import type { DatabaseSync } from 'node:sqlite'
import type { SearchFilter, SyncOptions } from '@his/core'
import {
  getItem,
  getVisits,
  listSourceProfiles,
  search,
  stats,
} from '@his/core'
import type { Handler } from './rpc.ts'
import type { SyncRunner } from './runner.ts'

export function createHandlers({ db, runner }: {
  db: DatabaseSync,
  runner: SyncRunner,
}): Record<string, Handler> {
  const handlers: Record<string, Handler> = {
    'history.search': (params) => search(db, params as SearchFilter),
    'history.getVisits': (params) => getVisits(db, params.urlId, params.limit),
    'history.getItem': (params) => getItem(db, params.id),
    'history.stats': (params) => stats(db, params.month),
    'sources.list': () => listSourceProfiles(db),
    'sync.run': (params) => runner.run(params as SyncOptions),
    'sync.status': () => runner.lastRun(),
  }
  return handlers
}
