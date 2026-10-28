# Security Policy

## Threat model

his is a **local-first, single-user** tool. It has no accounts and no login — its
security model is *network isolation* plus two gates on the RPC socket: `his serve`
binds to `127.0.0.1` only, so nothing outside your machine can reach it, and the
socket requires the per-run token and checks `Origin` when present. It also holds
sensitive data (your full browsing history) and can trigger side effects
(snapshotting browser profiles, writing the archive), so the notes below matter
if any of that changes.

### What his touches

- **Reads** your browsers' history databases, but only through a copy it makes
  (`VACUUM INTO` from a read-only handle). The browser's own data is never written.
- **Writes** only inside the archive home (`~/.his` by default): `history.db`,
  snapshot copies and `state.json` (pid, port, url and the `/rpc` token).
- **Serves** the WebUI and the RPC socket on `127.0.0.1`, using a port from 4477
  upward. `Ctrl+C` removes the state file.

### Defaults that keep it safe

- **Loopback binding.** `server/src/index.ts` hardcodes `HOST = '127.0.0.1'`;
  there is no LAN or remote mode.
- **Static path safety.** `..` segments are rejected and responses set
  `X-Content-Type-Options: nosniff` (`server/src/app.ts`).
- **RPC path gate.** Only `/rpc` upgrades; anything else is dropped without a
  response (`server/src/rpc.ts`).
- **Origin allow-list.** An upgrade carrying a non-loopback `Origin` is rejected
  with `403`; the list is `http://127.0.0.1:<port>` / `http://localhost:<port>`.
- **Per-run token.** A fresh `crypto.randomBytes(32)` token is required on every
  connection (`/rpc?token=…`), compared with `crypto.timingSafeEqual`.
- **Owner-only state file.** `state.json` carries the token and is written `0600`,
  and the token is injected only into the WebUI page served from loopback.
- **Window navigation gate.** The Desktop window may only show the loopback WebUI.
  New windows and navigations are denied in-window, and http(s) links are handed to
  the OS browser instead (`desktop/src/app.ts`).

### Known limitations

- **No user accounts.** Intentional for a loopback single-user tool. The Origin
  gate and token guard the *socket*, not *people*: a hostile page is blocked and
  other users cannot read an owner-only `state.json`, but any local user can obtain
  the token from the WebUI page served on loopback and connect to RPC. They can
  therefore read history and trigger sync. Isolation from other local users is out
  of scope for the first release and may be considered later. A process running as
  your own user can also read the token and connect.
- **TLS / remote exposure is out of scope.** See *Exposing beyond loopback* below.

### Known, accepted behaviors (not vulnerabilities)

- **WebUI favicon fetches.** To show site icons, the WebUI requests
  `https://<host>/favicon.ico` from the host you are viewing (`webui/src/views/Favicon.tsx`).
  This is an outbound request to that site, so those hosts can observe that you
  opened your archive, and when. No referrer is sent, and nothing from your
  archive is included.
- **Everything running as your user is trusted.** Any process running as your user
  can reach the socket and read `~/.his/state.json` (which holds the token); mode
  `0600` restricts access to that file, not to the loopback WebUI. The desktop app spawns the server as
  `node <cli>/bin.ts serve` and honours `HIS_CLI`, so treat your environment as
  trusted input.

## Supported versions

No releases yet (version `0.0.0`, work in progress). Fixes land on `main`.

Planned first release: the CLI as `@noy4/his` on npm (Node `>=22.22.3`) and an
unsigned desktop DMG for macOS 12+ on Apple silicon (arm64) only. The app is not
notarized, so macOS Gatekeeper requires a right-click-open on first launch.

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
your history and trigger syncs. The Origin allow-list expects a loopback origin
and the token is per-run (not user auth), so a fronting proxy has to account for
both.
