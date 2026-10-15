<img src="webui/public/favicon.svg" width="72" alt="his icon">

# his

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

```bash
pnpm -C cli run his sync                    # archive your browser history
pnpm -C cli run his sync --target chrome    # limit to one browser
pnpm -C cli run his query "sqlite"          # search the archive, prints JSON
pnpm -C cli run his serve --open            # serve the WebUI
```

`his sync` and `his serve` write to `~/.his` (override with `--home <dir>` or `HIS_HOME`).

## ⚖️ License

[MIT](./LICENSE)
