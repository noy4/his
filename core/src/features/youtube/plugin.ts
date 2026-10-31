import { search, stats } from './index.ts'
import type { ServerPlugin } from '../../plugin.ts'

export const youtube: ServerPlugin = {
  name: 'youtube',
  handlers: ({ db }) => ({
    'youtube.stats': (params) => stats(db, params),
    'youtube.search': (params) => search(db, params),
  }),
}
