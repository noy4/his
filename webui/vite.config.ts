import babel from '@rolldown/plugin-babel'
import react from '@vitejs/plugin-react'
import Icons from 'unplugin-icons/vite'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { defaultHome } from '@his/core/paths'
import { readState } from '@his/core/state'
import { defineConfig, type Plugin } from 'vite'

const SERVE = 'http://127.0.0.1:4477'

// https://vite.dev/config/
export default defineConfig({
  server: {
    proxy: {
      // origin=SERVE so the server's Origin gate accepts the dev page
      '/rpc': {
        target: SERVE,
        ws: true,
        changeOrigin: true,
        headers: { origin: SERVE },
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    tailwindcss(),
    react(),
    hisState(),
    // Iconify icons inlined at build time (no runtime API)
    // https://github.com/unplugin/unplugin-icons
    Icons({ compiler: 'jsx', jsx: 'react' }),
    // Preact Signals — plugin-react v6 dropped its `babel` option,
    // so the transform runs via @rolldown/plugin-babel instead.
    // Refs:
    //   https://github.com/preactjs/signals/blob/main/packages/react/README.md
    //   https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/CHANGELOG.md
    babel({
      plugins: ['module:@preact/signals-react-transform'],
    }),
  ],
})

// dev only: hand the WebUI the running serve's /rpc token
function hisState(): Plugin {
  return {
    name: 'his:state',
    apply: 'serve',
    transformIndexHtml(html) {
      const state = readState(defaultHome())
      if (state?.token === undefined) return html
      const tag = `<script>window.__HIS__=${JSON.stringify({ token: state.token })}</script>`
      return html.replace('</head>', `${tag}\n  </head>`)
    },
  }
}
