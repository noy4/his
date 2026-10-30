import { youtube as youtubeCore } from '@his/core/node'
import type { ServerPlugin } from './types.ts'

export const youtube: ServerPlugin = {
  name: 'youtube',
  handlers: ({ db }) => ({
    'youtube.stats': (params) => youtubeCore.stats(db, params),
    'youtube.search': (params) => youtubeCore.search(db, params),
  }),
}
