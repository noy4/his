import type { ViewPlugin } from './types'
import { github } from './github'
import { keywords } from './keywords'
import { youtube } from './youtube'

export const VIEW_PLUGINS: ViewPlugin[] = [keywords, github, youtube]
