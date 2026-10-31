import { search, stats } from './index.ts'
import type { ServerPlugin } from '../../plugin.ts'

export const keywords: ServerPlugin = {
  name: 'keywords',
  handlers: ({ db }) => ({
    'keywords.stats': (params) => stats(db, params),
    'keywords.search': (params) => search(db, params),
  }),
}
