#!/usr/bin/env node
import { cac } from 'cac'
import pkg from './package.json' with { type: 'json' }
import { withCtx } from './src/context.ts'
import { query } from './src/query.ts'
import { serveCommand } from './src/serve.ts'
import { status, stop } from './src/status.ts'
import { sync } from './src/sync/sync.ts'

const cli = cac('his')

cli.option('--home <dir>', 'archive home (env: HIS_HOME, default ~/.his)')

cli
  .command('sync', 'run sync once (kinds: chromium firefox safari takeout)')
  .option('--target <browser[:profile]>', 'limit to targets, repeatable (e.g. chrome, chrome:Default)')
  .option('--full', 'ignore watermarks and re-read everything (idempotent)')
  .action(withCtx((ctx, opts) => sync(ctx, {
    targets: opts.target === undefined ? undefined : [].concat(opts.target),
    full: opts.full
  })))

cli
  .command('query [...text]', 'read-only search against history.db, prints JSON')
  .option('--url <url>', 'match url')
  .option('--from <ms|date>', 'from timestamp')
  .option('--to <ms|date>', 'to timestamp')
  .option('--limit <n>', 'max results')
  .action(withCtx((ctx, text: string[], opts) =>
    query(ctx, {
      text,
      url: opts.url,
      from: opts.from,
      to: opts.to,
      limit: opts.limit,
    })))

cli
  .command('status', 'print the running instance (url + archive)')
  .action(withCtx((ctx) => status(ctx)))

cli
  .command('stop', 'SIGTERM the running instance')
  .action(withCtx((ctx) => stop(ctx)))

cli
  .command('serve', 'start http + rpc')
  .option('--port <n>', 'port to bind (default 4477); +1 on conflict')
  .option('--open', 'open the WebUI once the port is bound')
  .action(withCtx((ctx, opts) => serveCommand(ctx, {
    port: opts.port,
    open: opts.open,
  })))

cli.help()
cli.version(pkg.version)

cli.addEventListener('command:*', () => {
  console.error(`unknown command: ${cli.args.join(' ')}`)
})

async function main(): Promise<void> {
  cli.parse(process.argv, { run: false })
  if (cli.options.help === true || cli.options.version === true) return
  if (cli.matchedCommandName === undefined) {
    cli.outputHelp()
    process.exitCode = 1
    return
  }
  await cli.runMatchedCommand()
}

await main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
