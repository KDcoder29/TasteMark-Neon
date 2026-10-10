import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Runs the files in /api during `npm run dev`, the same way Vercel runs them when deployed.
function apiDev() {
  return {
    name: 'api-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next()
        try {
          const url = new URL(req.url, 'http://localhost')
          const name = url.pathname.slice('/api/'.length).replace(/[^a-zA-Z0-9_-]/g, '')
          const mod = await server.ssrLoadModule(`/api/${name}.js`)
          req.query = Object.fromEntries(url.searchParams)
          res.status = code => { res.statusCode = code; return res }
          res.json = body => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)) }
          await mod.default(req, res)
        } catch (e) {
          console.error('[api]', e)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'API error: ' + e.message }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))   // makes DATABASE_URL available to /api in dev
  return { plugins: [react(), tailwindcss(), apiDev()] }
})
