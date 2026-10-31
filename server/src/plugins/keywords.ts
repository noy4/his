import { keywords as keywordsCore } from '@his/core/node'
import type { ServerPlugin } from './types.ts'

export const keywords: ServerPlugin = {
  name: 'keywords',
  handlers: ({ db }) => ({
    'keywords.stats': (params) => keywordsCore.stats(db, params),
    'keywords.search': (params) => keywordsCore.search(db, params),
  }),
}
