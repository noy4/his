import babel from '@rolldown/plugin-babel'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
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