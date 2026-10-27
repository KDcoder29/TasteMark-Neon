// Records public/demo/bitemark-demo.mp4: the "Watch it in action" video in the Feature guide.
//
// How to re-record (after the screens change):
//  1. `npm run dev` on port 5199.
//  2. Run this function with the Playwright MCP tool `browser_run_code_unsafe` (paste the
//     `async (page) => { … }` below). Playwright needs its ffmpeg once: `node <playwright-core>/cli.js install ffmpeg`.
//  3. Convert the .webm it prints to MP4 + poster with any ffmpeg (e.g. npm `ffmpeg-static`):
//       ffmpeg -i in.webm -vf fps=30 -c:v libx264 -profile:v main -pix_fmt yuv420p -crf 24 -preset slow -movflags +faststart -an public/demo/bitemark-demo.mp4
//       ffmpeg -ss 3 -i in.webm -frames:v 1 -q:v 4 public/demo/poster.jpg
//
// Nothing real is touched: a separate browser session gets a fake login and the fictional journal
// in demo-data.json (every Neon Auth / Data API request is answered locally, writes included).
// Captions and a tap marker are drawn into the page; "Say it" uses a fake microphone.

async (page) => {
  const demo = await (await page.request.get('http://localhost:5199/e2e/demo/demo-data.json')).json()
  const ORIGIN = 'http://localhost:5199'
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const jwt = [b64({ alg: 'HS256', typ: 'JWT' }), b64({ sub: demo.user.id, email: demo.user.email, role: 'authenticated', iat: now, exp: now + 7200 }), 'demo'].join('.')
  const cors = req => ({ 'access-control-allow-origin': ORIGIN, 'access-control-allow-credentials': 'true', 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': req.headers()['access-control-request-headers'] || 'authorization,content-type', 'access-control-expose-headers': 'set-auth-jwt,content-range' })
  const json = (route, body, extra = {}) => route.fulfill({ status: 200, contentType: 'application/json', headers: { ...cors(route.request()), ...extra }, body: JSON.stringify(body) })

  // the video is recorded at the page's own size (deviceScaleFactor is ignored), so use a large phone
  const size = { width: 430, height: 932 }
  const ctx = await page.context().browser().newContext({ viewport: size, isMobile: true, hasTouch: true, recordVideo: { dir: '.playwright-mcp/video', size } })
  await ctx.route(/neonauth/, route => {
    const req = route.request()
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors(req) })
    if (/get-session/.test(req.url())) {
      const t = new Date().toISOString()
      return json(route, { session: { id: 's1', token: 'demo', userId: demo.user.id, expiresAt: new Date(Date.now() + 864e5).toISOString(), createdAt: t, updatedAt: t, ipAddress: '', userAgent: '', impersonatedBy: null, activeOrganizationId: null },
        user: { id: demo.user.id, name: demo.user.name, email: demo.user.email, emailVerified: true, image: null, createdAt: t, updatedAt: t, role: 'user', banned: false, banReason: null, banExpires: null } }, { 'set-auth-jwt': jwt })
    }
    return json(route, {})
  })
  await ctx.route(/apirest/, route => {
    const req = route.request(), u = req.url()
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors(req) })
    if (req.method() !== 'GET') return json(route, [])
    if (/\/places\?/.test(u)) return json(route, /group_id=is\.null/.test(u) ? demo.places : [])
    if (/\/wishlist\?/.test(u)) return json(route, /group_id=is\.null/.test(u) ? demo.wishlist : [])
    if (/profiles\?select=username/.test(u)) return json(route, [{ username: demo.user.username }])
    if (/profiles/.test(u)) return json(route, [{ id: demo.user.id, display_name: demo.user.username }])
    return json(route, [])
  })
  await ctx.addInitScript(() => {
    window.SpeechRecognition = window.webkitSpeechRecognition = class { start() { window.__rec = this } stop() { this.onend?.() } abort() {} }
    window.__say = async pieces => { const res = []; for (const p of pieces) { res.push(Object.assign([{ transcript: p }], { isFinal: true })); window.__rec.onresult({ results: [...res] }); await new Promise(r => setTimeout(r, 700)) } }
    localStorage.setItem('theme', 'light')
    addEventListener('DOMContentLoaded', () => {
      const st = document.createElement('style')
      st.textContent = `#demo-cap{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 74px);transform:translateX(-50%);z-index:99999;max-width:380px;
        padding:9px 16px;border-radius:99px;background:#0f2b21f2;color:#fff;font:700 15px Figtree,system-ui,sans-serif;text-align:center;
        box-shadow:0 8px 24px #0005;transition:opacity .3s,transform .3s;pointer-events:none;white-space:nowrap}
        #demo-cap.off{opacity:0;transform:translate(-50%,-8px)}
        .demo-tap{position:fixed;z-index:99998;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:#1d6b4f40;border:2px solid #1d6b4f;
        pointer-events:none;animation:demotap .6s ease-out forwards}
        @keyframes demotap{from{transform:scale(.5);opacity:1}to{transform:scale(1.5);opacity:0}}`
      document.head.append(st)
      const cap = Object.assign(document.createElement('div'), { id: 'demo-cap', className: 'off' }); document.body.append(cap)
      window.__cap = t => { if (!t) return cap.classList.add('off'); cap.textContent = t; cap.classList.remove('off') }
      addEventListener('pointerdown', e => { const d = Object.assign(document.createElement('div'), { className: 'demo-tap' }); d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px'; document.body.append(d); setTimeout(() => d.remove(), 650) }, true)
    })
  })

  const p = await ctx.newPage()
  const cap = t => p.evaluate(t => window.__cap(t), t)
  const wait = ms => p.waitForTimeout(ms)
  const tap = async loc => { await loc.scrollIntoViewIfNeeded(); await loc.click() }
  const typeSlow = async (loc, text) => { await loc.click(); await loc.pressSequentially(text, { delay: 110 }) }
  const log = []
  try {
    await p.goto(ORIGIN + '/'); await p.waitForSelector('.pcard', { timeout: 20000 }); await wait(600)
    await cap('Your food journal, on your phone'); await wait(2600)
    await p.mouse.wheel(0, 380); await wait(1300); await p.mouse.wheel(0, -380); await wait(700)
    await cap('Search any dish, place or area'); await wait(400)
    await typeSlow(p.locator('.searchbar input'), 'dosa'); await wait(1800)
    await tap(p.getByRole('button', { name: 'Clear search' })); await wait(500)
    await cap('Filters, the Zomato way'); await tap(p.getByRole('button', { name: /^Filters/ })); await wait(1200)
    await tap(p.locator('.drawer button', { hasText: /^Cafe/ }).first()); await wait(900)
    await tap(p.locator('.drawer button', { hasText: /^Show/ }).first()); await wait(1500)
    await tap(p.getByRole('button', { name: /Remove filter Cafe/ })); await wait(600)
    await cap('Open a place to see every dish'); await tap(p.locator('.pcard').first()); await wait(2600)
    await cap('Send it to friends as a picture'); await tap(p.getByRole('button', { name: /^Send / })); await wait(3400)
    await p.keyboard.press('Escape'); await wait(400); await p.keyboard.press('Escape'); await wait(500)
    await cap('Craving? Ask in your own words'); await tap(p.locator('.quick').first()); await wait(800)
    await typeSlow(p.locator('.drawer input').first(), 'south indian'); await p.keyboard.press('Enter'); await wait(3600)
    await p.keyboard.press('Escape'); await wait(500)
    await cap('Can’t decide? Let it pick'); await tap(p.locator('.quick').nth(1)); await wait(900)
    await tap(p.locator('.btn.btn-pri', { hasText: /Pick for/ })); await wait(3000)
    await p.keyboard.press('Escape'); await wait(500)
    await cap('Add a place: scan a bill or say it'); await tap(p.locator('.navplus')); await wait(1600)
    await tap(p.getByRole('menuitem', { name: /Say it/ })); await wait(900)
    await p.evaluate(() => window.__say(['Tasty Vadapav', 'vada pav 25 rupees 5 stars spicy will order again'])); await wait(500)
    await tap(p.getByRole('button', { name: 'Done', exact: true })); await wait(800)
    await p.locator('form.drawer').evaluate(f => f.querySelector('.seg')?.scrollIntoView({ block: 'center', behavior: 'smooth' })); await wait(2600)
    await p.keyboard.press('Escape'); await wait(500)
    await cap('Save places you want to try'); await tap(p.locator('.bottomnav button').nth(1)); await wait(2600)
    await cap('Your food story'); await tap(p.locator('.bottomnav button').last()); await wait(3200)
    await p.keyboard.press('Escape'); await wait(300)
    await cap('BiteMark: remember every great bite'); await tap(p.locator('.bottomnav button').first()); await wait(2400)
  } catch (e) { log.push('FAIL ' + e.message.split('\n')[0]); await p.screenshot({ path: '.playwright-mcp/video/fail.png' }) }
  const video = p.video()
  await ctx.close()
  log.push('video ' + await video.path())
  return log
}
