// Copies Tastemark data from Supabase to Neon, matching people by EMAIL.
//
// Why by email: passwords cannot be moved between the two login systems, so every person signs up
// again on the new site (same email). Their new user id differs from the old one, so this script
// rewrites every user id on the way across.
//
// Usage (from the project folder, after `npm i pg`):
//   Windows CMD:
//     set SUPABASE_DB_URL=postgresql://postgres.xxxx:PASSWORD@aws-0-xx.pooler.supabase.com:5432/postgres
//     set NEON_DB_URL=postgresql://neondb_owner:PASSWORD@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require
//     node scripts/migrate-from-supabase.mjs --dry        (shows what WOULD be copied; changes nothing)
//     node scripts/migrate-from-supabase.mjs              (copies for real)
//     node scripts/migrate-from-supabase.mjs --wipe       (empties the Neon tables first, then copies)
import pg from 'pg'

const { SUPABASE_DB_URL, NEON_DB_URL } = process.env
if (!SUPABASE_DB_URL || !NEON_DB_URL) {
  console.error('Set SUPABASE_DB_URL and NEON_DB_URL first (see the top of this file).')
  process.exit(1)
}
const dry = process.argv.includes('--dry')
const wipe = process.argv.includes('--wipe')
const ssl = { rejectUnauthorized: false }

// table -> { user columns to translate, parent checks }
const TABLES = [
  { t: 'profiles',       users: ['id'] },
  { t: 'groups',         users: ['owner_id'], keep: 'groups' },
  { t: 'group_members',  users: ['user_id'], needs: [['group_id', 'groups']] },
  { t: 'places',         users: ['user_id'], needs: [['group_id', 'groups', true]], keep: 'places' },
  { t: 'dishes',         users: ['user_id'], needs: [['place_id', 'places']], keep: 'dishes' },
  { t: 'dish_ratings',   users: ['user_id'], needs: [['dish_id', 'dishes']] },
  { t: 'dish_reactions', users: ['user_id'], needs: [['dish_id', 'dishes']] },
  { t: 'dish_comments',  users: ['user_id'], needs: [['dish_id', 'dishes']] },
  { t: 'wishlist',       users: ['user_id'], needs: [['group_id', 'groups', true]] },
  { t: 'group_activity', users: ['user_id'], nullUser: true, needs: [['group_id', 'groups']] },
]
const WITH_TRIGGERS = ['dishes', 'dish_ratings', 'dish_comments', 'group_members', 'wishlist']

const src = new pg.Client({ connectionString: SUPABASE_DB_URL, ssl })
const dst = new pg.Client({ connectionString: NEON_DB_URL, ssl })
await src.connect(); await dst.connect()

try {
  const oldUsers = (await src.query('select id, lower(email) as email from auth.users')).rows
  const newUsers = (await dst.query('select id, lower(email) as email from neon_auth."user"')).rows
  const newByEmail = new Map(newUsers.map(u => [u.email, u.id]))
  const idMap = new Map()
  const missing = []
  for (const u of oldUsers) {
    if (newByEmail.has(u.email)) idMap.set(u.id, newByEmail.get(u.email))
    else missing.push(u.email)
  }
  console.log(`People: ${oldUsers.length} in Supabase, ${idMap.size} already signed up on the new site.`)
  if (missing.length) console.log('NOT signed up on the new site yet (their data will be skipped):\n  ' + missing.join('\n  '))

  await dst.query('begin')

  if (wipe) {
    for (const { t } of [...TABLES].reverse()) await dst.query(`delete from public.${t}`)
    console.log('Neon tables emptied.')
  } else {
    for (const { t } of TABLES) {
      const n = (await dst.query(`select count(*)::int n from public.${t}`)).rows[0].n
      if (n > 0 && t !== 'profiles') throw new Error(`public.${t} already has ${n} rows on Neon. Re-run with --wipe to replace them.`)
    }
  }

  for (const t of WITH_TRIGGERS) await dst.query(`alter table public.${t} disable trigger user`)

  const kept = { groups: new Set(), places: new Set(), dishes: new Set() }
  for (const spec of TABLES) {
    const { t, users, needs = [], nullUser, keep } = spec
    const cols = (await dst.query(
      `select column_name from information_schema.columns where table_schema='public' and table_name=$1`, [t]
    )).rows.map(r => r.column_name)
    const rows = (await src.query(`select * from public.${t}`)).rows
    let ok = 0, skipped = 0, failed = 0

    for (const row of rows) {
      const r = { ...row }
      let drop = false
      for (const c of users) {
        if (r[c] == null) continue
        const nid = idMap.get(r[c])
        if (nid) r[c] = nid
        else if (nullUser) r[c] = null
        else drop = true
      }
      for (const [col, parent, optional] of needs) {
        if (r[col] == null && optional) continue
        if (!kept[parent].has(r[col])) drop = true
      }
      if (drop) { skipped++; continue }

      const use = Object.keys(r).filter(k => cols.includes(k))
      const sql = `insert into public.${t} (${use.map(k => `"${k}"`).join(',')}) values (${use.map((_, i) => `$${i + 1}`).join(',')})` +
        (t === 'profiles' ? ' on conflict (id) do update set display_name = excluded.display_name, username = excluded.username' : ' on conflict do nothing')
      await dst.query('savepoint s')
      try {
        await dst.query(sql, use.map(k => r[k]))
        await dst.query('release savepoint s')
        ok++
        if (keep) kept[keep].add(r.id)
      } catch (e) {
        await dst.query('rollback to savepoint s')
        failed++
        console.log(`  ! ${t}: ${e.message}`)
      }
    }
    console.log(`${t.padEnd(15)} copied ${ok}, skipped ${skipped}, failed ${failed}`)
  }

  for (const t of WITH_TRIGGERS) await dst.query(`alter table public.${t} enable trigger user`)

  if (dry) { await dst.query('rollback'); console.log('\nDRY RUN: nothing was changed.') }
  else { await dst.query('commit'); console.log('\nDone. Data copied to Neon.') }
} catch (e) {
  await dst.query('rollback').catch(() => {})
  console.error('\nFAILED, nothing was changed:', e.message)
  process.exitCode = 1
} finally {
  await src.end(); await dst.end()
}
