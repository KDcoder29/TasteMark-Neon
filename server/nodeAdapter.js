// Runs the Vercel-style handlers (req.query, res.setHeader, res.status().json()) as Next.js route
// handlers, so their logic and their answers stay exactly as they were.
export function toRouteHandler(handler) {
  return async request => {
    const query = Object.fromEntries(new URL(request.url).searchParams)
    const headers = { 'Content-Type': 'application/json' }
    let status = 200, body = null
    const res = {
      setHeader(name, value) { headers[name] = value; return res },
      status(code) { status = code; return res },
      json(data) { body = JSON.stringify(data); return res },
    }
    try {
      await handler({ query, method: request.method, headers: Object.fromEntries(request.headers) }, res)
    } catch (e) {
      // same shape as before, without the details (database errors can name the host)
      console.error('[api]', e)
      status = 500; body = JSON.stringify({ error: 'API error' })
    }
    return new Response(body, { status, headers })
  }
}
