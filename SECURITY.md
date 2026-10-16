# Security Policy

## Threat model

his is a **local-first, single-user** tool. It has no accounts and no
authentication by design — its security model is *network isolation*: `his serve`
binds to `127.0.0.1` only, so nothing outside your machine can reach it. It also
holds sensitive data (your full browsing history) and can trigger side effects
(snapshotting browser profiles, writing the archive), so the notes below matter
if any of that changes.

### What his touches

- **Reads** your browsers' history databases, but only through a copy it makes
  (`VACUUM INTO` from a read-only handle). The browser's own data is never written.
- **Writes** only inside the archive home (`~/.his` by default): `history.db`,
  staging copies and `state.json`.
- **Serves** the WebUI and the RPC socket on `127.0.0.1`, using a port from 4477
  upward. `Ctrl+C` / `his stop` removes the state file.

### Defaults that keep it safe

- **Loopback binding.** `server/src/index.ts` hardcodes `HOST = '127.0.0.1'`;
  there is no LAN or remote mode.
- **Static path safety.** `..` segments are rejected and responses set
  `X-Content-Type-Options: nosniff` (`server/src/app.ts`).
- **No secrets in the archive.** `state.json` records the pid, port, url and db
  path — nothing you would not want on disk.

### Known limitations (not hardened yet)

- **The RPC socket has no Origin check and no token.** `server/src/rpc.ts`
  accepts a WebSocket upgrade on any path from any origin. WebSockets are not
  subject to the same-origin policy, so **a page open in your browser can connect
  to `ws://127.0.0.1:4477/` and call RPC methods** — including `history.search`,
  `getItem`, `settings.set` and `sync.run`. The fix (path + Origin gate, plus a
  per-run token) is specified in `SPEC.rpc.html`.
- **No authentication.** Intentional for a loopback single-user tool; see
  *Exposing beyond loopback* below.

### Known, accepted behaviors (not vulnerabilities)

- **WebUI favicon fetches.** To show site icons, the WebUI requests
  `https://<host>/favicon.ico` from the host you are viewing (`webui/src/views/Favicon.tsx`).
  This is an outbound request to that site, so those hosts can observe that you
  opened your archive, and when. No referrer is sent, and nothing from your
  archive is included.
- **Everything on loopback is trusted.** Any process running as your user can
  reach the socket and read `~/.his`; file modes only stop other users. The
  desktop app spawns the server as `node <cli>/bin.ts serve` and honours
  `HIS_CLI`, so treat your environment as trusted input.

## Supported versions

No releases yet (version `0.0.0`, work in progress). Fixes land on `main`.

## Reporting a vulnerability

Please report privately — do not open a public issue.

- Preferred: **Security** tab → *Report a vulnerability*
  ([private advisory](https://github.com/noy4/his/security/advisories/new))
- Otherwise open a minimal issue asking for a private channel, without details.

Please include: what you did, what you expected, what actually happened, and the
commit you are on. This is a side project, so acknowledgment is best effort —
expect a few days rather than hours.

## Exposing beyond loopback

his has no built-in way to serve on a LAN or the internet. If you put a proxy in
front of it, you own the authentication: anyone who can reach the port can read
your history and trigger syncs.
