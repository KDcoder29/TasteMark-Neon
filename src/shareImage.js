// Draws the "Send to friends" picture: the place on a green band, then the dishes worth ordering
// with stars and price, then a small BiteMark footer. 1080px wide (sharp on every phone), as tall
// as the content. Fixed light colours, so it looks the same whatever theme the sender uses.
import { wrapLines } from './shareCard'
import { placeWhere } from './placeView'
import { tileColor } from './PlaceCard'

const C = { green: '#1d6b4f', greenSoft: '#e7f2ec', ink: '#17201c', mute: '#5f6b66', faint: '#8a948f', line: '#e6e9e7', star: '#e8a33d', starOff: '#dde2df', saffron: '#f26b1d', white: '#ffffff', bandText: '#cfe6db' }
const W = 1080, PAD = 72
const font = (w, px) => `${w} ${px}px Figtree, "Segoe UI", Roboto, system-ui, sans-serif`
let pin   // made on first use: Path2D only exists in the browser
const PIN = () => (pin ||= new Path2D('M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z'))

function star(ctx, cx, cy, r) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r
    ctx.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a))
  }
  ctx.closePath()
}
// five stars, partly filled for averages like 4.5
function stars(ctx, x, y, n, r = 17) {
  for (let i = 0; i < 5; i++) {
    const cx = x + r + i * (r * 2 + 8), fill = Math.max(0, Math.min(1, n - i))
    star(ctx, cx, y, r); ctx.fillStyle = C.starOff; ctx.fill()
    if (fill > 0) {
      ctx.save(); ctx.beginPath(); ctx.rect(cx - r, y - r, r * 2 * fill, r * 2); ctx.clip()
      star(ctx, cx, y, r); ctx.fillStyle = C.star; ctx.fill(); ctx.restore()
    }
  }
  return 5 * (r * 2 + 8)
}
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r) }

async function fontsReady() {
  try { await Promise.all(['400', '600', '700', '800'].map(w => document.fonts.load(font(w, 40)))) } catch {}
}

// place: with dishes; shown/more: from pickShareDishes; group: the group's name, or null
export async function drawShareCard({ place, shown, more, prices, notes, group }) {
  await fontsReady()
  const cv = document.createElement('canvas')
  cv.width = W; cv.height = 4000
  const ctx = cv.getContext('2d')
  ctx.textBaseline = 'alphabetic'
  const measure = f => s => { ctx.font = f; return ctx.measureText(s).width }

  // ---- green band: letter tile, name, where, categories
  let y = PAD + 8
  const tile = 112
  roundRect(ctx, PAD, y, tile, tile, 30); ctx.fillStyle = tileColor(place); ctx.fill()
  ctx.lineWidth = 6; ctx.strokeStyle = '#ffffff33'; ctx.stroke()
  ctx.fillStyle = C.white; ctx.font = font(800, 60); ctx.textAlign = 'center'
  ctx.fillText(place.name.trim()[0]?.toUpperCase() || '?', PAD + tile / 2, y + tile / 2 + 21)
  ctx.textAlign = 'left'
  y += tile + 100
  const nameLines = wrapLines(measure(font(800, 76)), place.name, W - PAD * 2, 2)
  const bandTop = 0
  const where = placeWhere(place)
  const cats = place.categories || []
  const bandH = y + nameLines.length * 86 - 40 + (where ? 62 : 0) + (cats.length ? 78 : 0) + 56
  ctx.save(); ctx.globalCompositeOperation = 'destination-over'
  ctx.fillStyle = C.green; ctx.fillRect(0, bandTop, W, bandH); ctx.restore()
  ctx.fillStyle = C.saffron; ctx.fillRect(0, 0, W, 12)

  ctx.fillStyle = C.white; ctx.font = font(800, 76)
  for (const l of nameLines) { ctx.fillText(l, PAD, y); y += 86 }
  y -= 40
  if (where) {
    y += 62
    ctx.save(); ctx.translate(PAD - 2, y - 33); ctx.scale(1.7, 1.7)
    ctx.lineWidth = 2; ctx.strokeStyle = C.bandText; ctx.stroke(PIN()); ctx.restore()
    ctx.fillStyle = C.bandText; ctx.font = font(500, 36)
    ctx.fillText(wrapLines(measure(font(500, 36)), where, W - PAD * 2 - 52, 1)[0], PAD + 50, y)
  }
  if (cats.length) {
    y += 34
    let x = PAD
    ctx.font = font(700, 28)
    for (const c of cats) {
      const w = ctx.measureText(c).width + 40
      roundRect(ctx, x, y, w, 50, 25); ctx.fillStyle = '#ffffff26'; ctx.fill()
      ctx.fillStyle = C.white; ctx.fillText(c, x + 20, y + 35); x += w + 12
    }
    y += 44
  }
  y = bandH

  // ---- the dishes
  ctx.fillStyle = C.white; ctx.fillRect(0, y, W, cv.height - y)
  y += 76
  const best = shown.length && shown[0].stars >= 4
  ctx.fillStyle = C.mute; ctx.font = font(600, 34)
  ctx.fillText(best ? 'What to order' : 'What I tried', PAD, y)
  y += 26

  const priceW = prices ? 200 : 0
  shown.forEach((d, i) => {
    if (i) { ctx.save(); ctx.setLineDash([10, 10]); ctx.strokeStyle = C.line; ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke(); ctx.restore() }
    y += 72
    const top = y
    ctx.fillStyle = C.ink; ctx.font = font(700, 46)
    for (const l of wrapLines(measure(font(700, 46)), d.name, W - PAD * 2 - priceW, 2)) { ctx.fillText(l, PAD, y); y += 56 }
    if (prices && d.price) {
      ctx.fillStyle = C.green; ctx.font = font(800, 44); ctx.textAlign = 'right'
      ctx.fillText(`₹${d.price}`, W - PAD, top); ctx.textAlign = 'left'
    }
    y += 6
    const sw = stars(ctx, PAD, y - 12, d.stars)
    ctx.fillStyle = C.mute; ctx.font = font(600, 30)
    const label = Number.isInteger(d.stars) ? '' : d.stars.toFixed(1)
    let x = PAD + sw + 8
    if (label) { ctx.fillText(label, x, y); x += ctx.measureText(label).width + 20 }
    if (d.order_again === 'yes') {
      ctx.font = font(700, 26); const t = 'Would order again', w = ctx.measureText(t).width + 32
      roundRect(ctx, x, y - 36, w, 46, 23); ctx.fillStyle = C.greenSoft; ctx.fill()
      ctx.fillStyle = C.green; ctx.fillText(t, x + 16, y - 4)
    }
    y += 14
    if (notes && d.note?.trim()) {
      ctx.fillStyle = C.mute; ctx.font = font(400, 34)
      for (const l of wrapLines(measure(font(400, 34)), d.note.trim(), W - PAD * 2, 2)) { y += 46; ctx.fillText(l, PAD, y) }
    }
    y += 34
  })
  if (more > 0) {
    y += 30
    ctx.fillStyle = C.faint; ctx.font = font(500, 30)
    ctx.fillText(`+ ${more} more ${more === 1 ? 'dish' : 'dishes'} in my journal`, PAD, y)
    y += 10
  }

  // ---- footer
  y += 64
  ctx.fillStyle = C.line; ctx.fillRect(PAD, y, W - PAD * 2, 2)
  y += 72
  ctx.fillStyle = C.green; ctx.font = font(800, 36); ctx.fillText('BiteMark', PAD, y)
  const bw = ctx.measureText('BiteMark').width
  ctx.fillStyle = C.faint; ctx.font = font(500, 30); ctx.fillText('  my food journal', PAD + bw, y)
  ctx.textAlign = 'right'; ctx.fillText(group ? `Rated by ${group}` : 'My own ratings', W - PAD, y); ctx.textAlign = 'left'
  y += 64

  // crop to the content
  const h = Math.ceil(y)
  const out = document.createElement('canvas')
  out.width = W; out.height = h
  const o = out.getContext('2d')
  o.fillStyle = C.white; o.fillRect(0, 0, W, h)
  o.drawImage(cv, 0, 0)
  return new Promise(res => out.toBlob(res, 'image/png'))
}
