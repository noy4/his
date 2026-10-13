import electron from 'vite-plugin-electron'
import { defineConfig } from 'vite'

// main-process only: the renderer is webui, loaded from `his serve` (loopback) at runtime.
export default defineConfig({
  plugins: [
    electron({
      entry: 'src/main.ts',
      vite: {
        build: { outDir: 'dist' },
      },
    }),
  ],
})
