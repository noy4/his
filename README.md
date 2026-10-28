<img src="webui/public/favicon.svg" width="72" alt="his icon">

# his (WIP)

Browser history archive & viewer.

[Website](https://noy4.github.io/his/)

## ✨ Features

- 🗄️ **One archive** — every browser's history into one file
- 📊 **Stats** — turns your history into charts and totals, per month or all time
- 🔁 **Automatic sync** — runs on a schedule

## 🖥️ Desktop app

A macOS menu bar app that runs the server for you.

```bash
pnpm install
pnpm -C webui run build     # build the WebUI
pnpm -C desktop run dev     # launch the menu bar app
```

## ⌨️ CLI

The CLI is not published yet. To build and install it from a checkout, use Node.js 22.22.3 or later and pnpm:

```bash
pnpm install
pnpm -C cli run build
pnpm -C cli pack
npm install -g ./cli/his-cli-0.0.0.tgz
```

Choose sync targets in the WebUI's **Sources** page, or specify a browser for a one-time sync:

```bash
his serve --open                  # open the WebUI and select sources
his sync --target chrome          # sync Chrome once
his sync                          # sync selected sources
his query "sqlite"                # search the archive as JSON
his status                        # show the running server
```

Data is stored in `~/.his` (override with `--home` or `HIS_HOME`).

## 🔗 Related projects

[joshuatownsend/chrome-history-explorer](https://github.com/joshuatownsend/chrome-history-explorer) — prior art: a browser history explorer (TypeScript). his skips some of those features (**AI interest maps**, **rabbit-hole detection**, **liveness checks**, etc.) and adds **continuous background sync** and a **macOS menu bar app**.

## ⚖️ License

[MIT](./LICENSE)
