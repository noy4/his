import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Bump the packaged workspaces (cli + desktop) to one version, commit and tag
// it. The release workflow asserts the pushed tag matches cli/package.json, so
// they must never drift; keeping the edit in one place enforces that.
//
//   node scripts/release.mjs 0.3.0          # bump + commit + tag
//   node scripts/release.mjs 0.3.0 --push   # also push HEAD and the tag

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const PACKAGES = ['cli/package.json', 'desktop/package.json']

const args = process.argv.slice(2)
const push = args.includes('--push')
const raw = args.find((arg) => !arg.startsWith('-'))

function fail(message) {
  console.error(message)
  process.exit(1)
}

if (!raw) fail('usage: node scripts/release.mjs <version> [--push]')

const version = raw.replace(/^v/, '')
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) fail(`invalid version: ${raw}`)

const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' })

if (git('status', '--porcelain').trim()) fail('working tree is not clean; commit or stash first')

const tag = `v${version}`
if (git('tag', '--list', tag).trim()) fail(`tag ${tag} already exists`)

const files = PACKAGES.map((rel) => path.join(root, rel))
const versions = files.map((file) => JSON.parse(readFileSync(file, 'utf8')).version)
if (new Set(versions).size !== 1) fail(`package versions already differ: ${versions.join(', ')}`)
if (versions[0] === version) fail(`already at ${version}`)

for (const file of files) {
  const text = readFileSync(file, 'utf8')
  writeFileSync(file, text.replace(/("version":\s*)"[^"]*"/, `$1"${version}"`))
}

git('add', ...PACKAGES)
git('commit', '-m', `chore(release): ${tag}`)
git('tag', tag)
console.log(`bumped ${versions[0]} -> ${version}; committed and tagged ${tag}`)

if (push) {
  git('push', 'origin', 'HEAD')
  git('push', 'origin', tag)
  console.log(`pushed HEAD and ${tag}`)
} else {
  console.log(`next: git push origin HEAD && git push origin ${tag}`)
}
