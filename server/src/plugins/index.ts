import type { ServerPlugin } from './types.ts'
import { github } from './github.ts'
import { keywords } from './keywords.ts'
import { youtube } from './youtube.ts'

export const PLUGINS: ServerPlugin[] = [keywords, github, youtube]
