import type { ServerPlugin } from './types.ts'
import { github } from './github.ts'
import { youtube } from './youtube.ts'

export const PLUGINS: ServerPlugin[] = [github, youtube]
