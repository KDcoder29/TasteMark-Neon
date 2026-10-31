import { describe, expect, test } from 'vitest'
import { toRouteHandler } from './nodeAdapter'

describe('Vercel-style (req, res) handlers served as Next.js route handlers', () => {
  test('query, headers, status and JSON body carry over', async () => {
    const GET = toRouteHandler(async (req, res) => { res.setHeader('Cache-Control', 'no-store'); res.status(200).json({ ok: true, q: req.query.x }) })
    const r = await GET(new Request('http://h/api/t?x=1'))
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ ok: true, q: '1' })
    expect(r.headers.get('cache-control')).toBe('no-store')
    expect(r.headers.get('content-type')).toContain('application/json')
  })
  test('an error status keeps its body', async () => {
    const GET = toRouteHandler(async (req, res) => res.status(400).json({ error: 'Missing parameter' }))
    const r = await GET(new Request('http://h/api/t'))
    expect(r.status).toBe(400)
    expect(await r.json()).toEqual({ error: 'Missing parameter' })
  })
  test('json() without status() is a 200', async () => {
    const GET = toRouteHandler(async (req, res) => res.json({ a: 1 }))
    expect((await GET(new Request('http://h/api/t'))).status).toBe(200)
  })
  test('a crash inside the handler is a 500 JSON error (no server details)', async () => {
    const GET = toRouteHandler(async () => { throw new Error('connect ECONNREFUSED db.secret-host') })
    const r = await GET(new Request('http://h/api/t'))
    expect(r.status).toBe(500)
    expect(await r.json()).toEqual({ error: 'API error' })
  })
})
