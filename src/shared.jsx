// Small pieces used by several screens.

export const CATEGORIES = ['Food', 'Cafe', 'Healthy', 'Dessert']

export const norm = s => (s || '').trim().toLowerCase()

const hue = s => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) % 360; return h }
export const tint = s => `hsl(${hue(s)} 38% 42%)`            // a calm, distinct color per person / group
export const initial = s => ((s || '?').trim()[0] || '?').toUpperCase()

export function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return Math.floor(s / 60) + 'm ago'
  if (s < 86400) return Math.floor(s / 3600) + 'h ago'
  if (s < 604800) return Math.floor(s / 86400) + 'd ago'
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export const Stars = ({ n = 0 }) => (
  <span className="text-sm tracking-tight">
    {[1, 2, 3, 4, 5].map(i => <span key={i} style={{ color: i <= n ? 'var(--star)' : 'var(--star-off)' }}>★</span>)}
  </span>
)

export function Avatar({ text, color, size = 28 }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-full font-bold text-white"
      style={{ width: size, height: size, background: color, fontSize: size * 0.42 }}>{initial(text)}</span>
  )
}

// Price inputs: digits only, at most 4 of them (0-9999)
export const priceInput = v => String(v ?? '').replace(/\D/g, '').slice(0, 4)
export const priceProps = { type: 'text', inputMode: 'numeric', pattern: '[0-9]*', maxLength: 4 }

// Price slider scale that follows the dearest dish: max 2000 -> slider runs 0 to 2000
export function priceScale(places) {
  let max = 0
  for (const p of places || []) for (const d of p.dishes || []) if (d.price > max) max = d.price
  if (!max) return { cap: 100, step: 10 }
  const step = max <= 200 ? 10 : max <= 1000 ? 50 : max <= 3000 ? 100 : 500
  return { cap: Math.ceil(max / step) * step, step }
}

// Tick marks for the price slider: one per price, but prices that sit close together
// (e.g. 900, 901 ... 907) are merged into ONE tick at their average.
export function priceTicks(places, cap) {
  const prices = []
  for (const p of places || []) for (const d of p.dishes || []) if (d.price > 0) prices.push(d.price)
  prices.sort((a, b) => a - b)
  const gap = cap * 0.04
  const groups = []
  for (const v of prices) {
    const g = groups[groups.length - 1]
    if (g && v - g.min <= gap) { g.sum += v; g.n += 1; g.max = v }
    else groups.push({ min: v, max: v, sum: v, n: 1 })
  }
  let lastLabelled = -1
  return groups.map(g => {
    const avg = g.sum / g.n
    const pos = Math.min(1, avg / cap)
    const label = pos - lastLabelled >= 0.1 || lastLabelled < 0
    if (label) lastLabelled = pos
    return { avg, pos, min: g.min, max: g.max, n: g.n, label }
  })
}

export function PriceSlider({ places, scale, maxPrice, onChange }) {
  const { cap, step } = scale
  const ticks = priceTicks(places, cap)
  return (
    <div>
      <input type="range" min={0} max={cap} step={step} value={Math.min(maxPrice ?? cap, cap)}
        onChange={e => onChange(+e.target.value >= cap ? null : +e.target.value)}
        className="mt-1 block w-full" style={{ accentColor: 'var(--pri)' }} />
      <div className="relative mt-0.5 h-8">
        {ticks.map(t => (
          <button type="button" key={t.min + '-' + t.max}
            onClick={() => onChange(t.max >= cap ? null : t.max)}
            title={(t.n > 1 ? `₹${t.min} to ₹${t.max}` : `₹${t.min}`) + ` · ${t.n} dish${t.n > 1 ? 'es' : ''}. Tap to set the max here.`}
            className="absolute top-0 flex -translate-x-1/2 flex-col items-center px-1 transition hover:scale-110"
            style={{ left: `calc(8px + (100% - 16px) * ${t.pos})` }}>
            <span className="block h-2 w-0.5 rounded" style={{ background: 'var(--pri)' }} />
            {t.label && <span className="mt-0.5 text-[10px] leading-none" style={{ color: 'var(--mute)' }}>₹{Math.round(t.avg)}</span>}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-[11px]"><span>₹0</span><span>₹{cap}</span></div>
    </div>
  )
}
