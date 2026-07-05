import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/renderer/**/*.{ts,tsx,html}'
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#1a1a2e',
          secondary: '#16213e',
          elevated: '#0f3460'
        }
      }
    }
  },
  plugins: []
}

export default config
