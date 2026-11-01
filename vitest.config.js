import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// Tests only: the app itself runs on Next.js.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  test: { include: ['lib/**/*.test.js', 'components/**/*.test.{js,jsx}', 'hooks/**/*.test.js', 'server/**/*.test.js'] },
})
