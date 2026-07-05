import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin, loadEnv } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Loads .env / .env.[mode] files plus already-exported process env vars
  // (so CI/release pipelines can inject the secret without a .env on disk).
  const env = loadEnv(mode, process.cwd(), '')
  const builtinKey = JSON.stringify(env.BUILTIN_ANTHROPIC_API_KEY ?? '')

  return {
    main: {
      plugins: [externalizeDepsPlugin()],
      define: {
        // Compiled into the main bundle ONLY — never the renderer (which is
        // far more inspectable via DevTools). Empty string in dev builds
        // where the env var isn't set; getApiKey() falls back gracefully.
        __BUILTIN_API_KEY__: builtinKey
      }
    },
    preload: {
      plugins: [externalizeDepsPlugin()]
    },
    renderer: {
      resolve: {
        alias: {
          '@renderer': resolve('src/renderer/src')
        }
      },
      plugins: [react()]
    }
  }
})
