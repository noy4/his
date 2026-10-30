import electron from 'vite-plugin-electron'
import { defineConfig } from 'vite'

export default defineConfig({
  // stay off webui's port
  server: { port: 0 },
  plugins: [
    electron({
      entry: 'src/main.ts',
      vite: {
        build: { outDir: 'dist' },
      },
    }),
  ],
})
