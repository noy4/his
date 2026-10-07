import type { DatabaseSync } from 'node:sqlite'
import {
  getItem,
  getVisits,
  listSourceProfiles,
  search,
  stats,
} from '@his/core'
import type { Handler } from './rpc.ts'
import { monthParam, numberParam, optionalNumber, searchFilter, syncOptions } from './rpc-params.ts'
import type { SyncRunner } from './runner.ts'

export function createHandlers({ db, runner }: {
  db: DatabaseSync,
  runner: SyncRunner,
}): Record<string, Handler> {
  const handlers: Record<string, Handler> = {
    'history.search': (params) => search(db, searchFilter(params)),
    'history.getVisits': (params) => getVisits(db, numberParam(params, 'urlId'), optionalNumber(params, 'limit')),
    'history.getItem': (params) => getItem(db, numberParam(params, 'id')),
    'history.stats': (params) => stats(db, monthParam(params)),
    'sources.list': () => listSourceProfiles(db),
    'sync.run': (params) => runner.run(syncOptions(params)),
    'sync.status': () => runner.lastRun(),
  }
  return handlers
}
