import babel from '@rolldown/plugin-babel'
import react from '@vitejs/plugin-react'
import Icons from 'unplugin-icons/vite'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
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