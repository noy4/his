#!/usr/bin/env node
import { cac } from 'cac'
import pkg from './package.json' with { type: 'json' }
import { resolveHome } from './src/home.ts'
import { query } from './src/query.ts'
import { serveCommand } from './src/serve.ts'
import { status, stop } from './src/status.ts'
import { sync } from './src/sync.ts'

interface CommandOptions {
  home?: string
  source?: string
  full?: boolean
  url?: string
  from?: string
  to?: string
  limit?: string
  port?: string
  open?: boolean
}

const cli = cac('his')

cli.option('--home <dir>', 'archive home (env: HIS_HOME, default ~/.his)')

cli
  .command('sync', 'run sync once (kinds: chromium firefox safari takeout)')
  .option('--source <kind>', 'limit to one source instead of all')
  .option('--full', 'ignore watermarks and re-read everything (idempotent)')
  .action((opts: CommandOptions) => sync(resolveHome(opts.home), {
    source: opts.source,
    full: opts.full
  }))

cli
  .command('query [...text]', 'read-only search against history.db, prints JSON')
  .option('--url <url>', 'match url')
  .option('--from <ms|date>', 'from timestamp')
  .option('--to <ms|date>', 'to timestamp')
  .option('--limit <n>', 'max results')
  .action((text: string[], opts: CommandOptions) =>
    query(resolveHome(opts.home), {
      text,
      url: opts.url,
      from: opts.from,
      to: opts.to,
      limit: opts.limit,
    }))

cli
  .command('status', 'print the running instance (url + archive)')
  .action((opts: CommandOptions) => status(resolveHome(opts.home)))

cli
  .command('stop', 'SIGTERM the running instance')
  .action((opts: CommandOptions) => stop(resolveHome(opts.home)))

cli
  .command('serve', 'start http + rpc')
  .option('--port <n>', 'port to bind (default 4477); +1 on conflict')
  .option('--open', 'open the WebUI once the port is bound')
  .action((opts: CommandOptions) => serveCommand({
    home: resolveHome(opts.home),
    port: opts.port,
    open: opts.open,
  }))

cli.help()
cli.version(pkg.version)

cli.addEventListener('command:*', () => {
  console.error(`unknown command: ${cli.args.join(' ')}`)
})

async function main(): Promise<number> {
  try {
    cli.parse(process.argv, { run: false })
    if (cli.options.help === true || cli.options.version === true) return 0
    if (cli.matchedCommandName === undefined) {
      cli.outputHelp()
      return 1
    }
    return (await cli.runMatchedCommand()) as number
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 1
  }
}

process.exitCode = await main()