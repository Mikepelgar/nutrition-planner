import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Core logic under test is pure TS (no Electron / DOM), so the fast node
    // environment is sufficient.
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: true
  }
})
