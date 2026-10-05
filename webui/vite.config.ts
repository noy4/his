import babel from '@rolldown/plugin-babel'
import react from '@vitejs/plugin-react'
import Icons from 'unplugin-icons/vite'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // dev も same-origin(`/rpc` → his serve) — prod(dist + his serve)と同一経路
  server: {
    proxy: {
      '/rpc': { target: 'http://127.0.0.1:4477', ws: true, changeOrigin: true },
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