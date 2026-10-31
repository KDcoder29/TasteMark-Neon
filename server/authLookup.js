// Vercel serverless function: lets the login screen turn a username into an email,
// and check whether a username is free, BEFORE the person is signed in.
// Needs the server-only env var DATABASE_URL (Neon connection string).
import { neon } from '@neondatabase/serverless'

const USERNAME = /^[A-Za-z0-9_.]{3,20}$/

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const sql = neon(process.env.DATABASE_URL)
  const { username, available } = req.query || {}

  try {
    // GET /api/auth-lookup?ping=1 — sent when the login page opens, so the database (which sleeps
    // when idle on Neon's free plan, ~2.5 s to wake) is awake by the time "Log in" is pressed
    if (req.query?.ping !== undefined) {
      await sql`select 1`
      return res.status(200).json({ ok: true })
    }

    if (available !== undefined) {                     // GET /api/auth-lookup?available=kandarp29
      if (!USERNAME.test(available)) return res.status(200).json({ available: false })
      const rows = await sql`select 1 from public.profiles where lower(username) = lower(${available}) limit 1`
      // names that are registered but have no profile row yet (never logged in) count as taken too
      const pending = await sql`select 1 from neon_auth."user" where lower(name) = lower(${available}) limit 1`
      return res.status(200).json({ available: rows.length === 0 && pending.length === 0 })
    }

    if (username !== undefined) {                      // GET /api/auth-lookup?username=kandarp29
      if (!USERNAME.test(username)) return res.status(200).json({ email: null })
      const rows = await sql`
        select u.email from neon_auth."user" u
        where lower(u.name) = lower(${username}) limit 1`
      return res.status(200).json({ email: rows[0]?.email ?? null })
    }

    return res.status(400).json({ error: 'Missing parameter' })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: 'Lookup failed' })
  }
}
