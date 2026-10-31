import { search, stats } from './index.ts'
import type { ServerPlugin } from '../../plugin.ts'

export const github: ServerPlugin = {
  name: 'github',
  handlers: ({ db }) => ({
    'github.stats': (params) => stats(db, params),
    'github.search': (params) => search(db, params),
  }),
}
