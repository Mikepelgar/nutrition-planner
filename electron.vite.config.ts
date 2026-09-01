import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin, loadEnv } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Loads .env / .env.[mode] files plus already-exported process env vars
  // (so CI/release pipelines can inject the secret without a .env on disk).
  const env = loadEnv(mode, process.cwd(), '')

  return {
    main: {
      plugins: [externalizeDepsPlugin()],
      define: {
        // Supabase project coordinates. Both are publishable — the anon key
        // grants only what the RLS policies allow — so unlike the provider key
        // these replaced, there is nothing here worth extracting from a build.
        // Empty in a from-source build with no .env; the app reports AI as
        // unconfigured rather than failing at the first request.
        __SUPABASE_URL__: JSON.stringify(env.SUPABASE_URL ?? ''),
        __SUPABASE_ANON_KEY__: JSON.stringify(env.SUPABASE_ANON_KEY ?? '')
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
