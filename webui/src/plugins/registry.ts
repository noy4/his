import type { ViewPlugin } from './types'
import { github } from './github'
import { youtube } from './youtube'

export const VIEW_PLUGINS: ViewPlugin[] = [github, youtube]
