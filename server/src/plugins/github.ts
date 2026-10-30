import { github as githubCore } from '@his/core/node'
import type { ServerPlugin } from './types.ts'

export const github: ServerPlugin = {
  name: 'github',
  handlers: ({ db }) => ({
    'github.stats': (params) => githubCore.stats(db, params),
    'github.search': (params) => githubCore.search(db, params),
  }),
}
