import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Tests only: the app itself runs on Next.js.
export default defineConfig({
  plugins: [react()],
  test: { include: ['src/**/*.test.{js,jsx}', 'server/**/*.test.js'] },
})
