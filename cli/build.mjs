import { build } from 'tsdown'
import { access, cp } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// paths
const root = path.dirname(fileURLToPath(import.meta.url))
const dist = path.join(root, 'dist')
const webui = path.join(root, '../webui/dist')

// build cli
await access(path.join(webui, 'index.html'))
await build({
  entry: ['bin.ts'],
  outDir: 'dist',
})

// copy migrations
await cp(path.join(root, '../core/src/db/migrations'), path.join(dist, 'migrations'), { recursive: true })
// copy webui
await cp(webui, path.join(dist, 'webui/dist'), { recursive: true })
