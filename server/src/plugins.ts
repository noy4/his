import { github, keywords, youtube } from '@his/core/node'
import type { ServerPlugin } from '@his/core/node'

// Server plugin registry
export const PLUGINS: ServerPlugin[] = [
  keywords,
  github,
  youtube,
]
