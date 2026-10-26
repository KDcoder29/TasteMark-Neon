import { useEffect, useMemo, useState } from 'react'
import Icon from './Icons'
import { CATEGORIES, PriceSlider } from './shared'
import { filterPlaces, activeFilterCount, NO_FILTERS, SORTS } from './journalFilter'
import { useSheetDrag } from './useGestures'

// Phone filters, the Zomato / Swiggy way: sections on the left, options on the right, and a live
// "Show N places" so you know what you'll get before applying. Works on a draft; nothing changes
// behind the sheet until "Show".
export default function FilterSheet({ places, filters, sort, scale, cities, start = 'sort', onApply, onClose }) {
  const drag = useSheetDrag(onClose)
  const [d, setD] = useState(filters)
  const [s, setS] = useState(sort)
  const [tab, setTab] = useState(start)
  const set = patch => setD(prev => ({ ...prev, ...patch }))
  const count = useMemo(() => filterPlaces(places, d, scale.cap).length, [places, d, scale.cap])
  const catCount = c => places.filter(p => (p.categories || []).includes(c)).length
  const priceOn = d.maxPrice != null && d.maxPrice < scale.cap

  useEffect(() => {
    const key = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', key)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = prev }
  }, [onClose])

  const tabs = [
    ['sort', 'Sort by', s !== 'recent'],
    ['cat', 'Category', d.cat !== 'All'],
    ...(cities.length > 1 ? [['city', 'City', d.city !== 'All']] : []),
    ['price', 'Price', priceOn],
    ['rating', 'Rating', d.minRate > 0],
    ['more', 'More', d.again],
  ]

  // one option row: a radio (pick one) or a checkbox (on/off)
  const Opt = ({ on, onPick, label, sub, box = false }) => (
    <button type="button" role={box ? 'checkbox' : 'radio'} aria-checked={on} onClick={onPick}
      className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left transition active:scale-[.98]">
      <span className="grid h-5 w-5 shrink-0 place-items-center transition"
        style={{ borderRadius: box ? 6 : 99, border: `2px solid ${on ? 'var(--pri)' : 'var(--line)'}`, background: on && box ? 'var(--pri)' : 'transparent' }}>
        {on && (box ? <Icon name="check" size={12} stroke={3.2} style={{ color: 'var(--on-pri)' }} />
          : <span className="block h-2.5 w-2.5 rounded-full" style={{ background: 'var(--pri)' }} />)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px]" style={{ fontWeight: on ? 700 : 500 }}>{label}</span>
        {sub && <span className="block text-xs" style={{ color: 'var(--mute)' }}>{sub}</span>}
      </span>
    </button>
  )

  return (
    <>
      <div className="scrim" onMouseDown={onClose} />
      <section ref={drag} className="drawer !max-h-[86vh]" role="dialog" aria-modal="true" aria-label="Filters">
        <div className="grabber" />
        <div className="flex items-center justify-between border-b px-5 pb-3 pt-1" style={{ borderColor: 'var(--line)' }}>
          <h2 className="m-0 text-lg font-extrabold">Filters</h2>
          <button onClick={onClose} aria-label="Close filters" className="ghost grid h-9 w-9 place-items-center rounded-full" style={{ color: 'var(--mute)' }}>
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="flex min-h-[340px] flex-1 overflow-hidden">
          <div role="tablist" aria-orientation="vertical" className="w-[118px] shrink-0 overflow-y-auto border-r py-1" style={{ background: 'var(--surface-2)', borderColor: 'var(--line)' }}>
            {tabs.map(([k, l, active]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                className="relative flex w-full items-center justify-between gap-1 py-3.5 pl-4 pr-2 text-left text-[14px] transition"
                style={tab === k ? { background: 'var(--surface)', color: 'var(--pri)', fontWeight: 700 } : { color: 'var(--ink)', fontWeight: 500 }}>
                {tab === k && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r" style={{ background: 'var(--pri)' }} />}
                {l}
                {active && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: 'var(--accent)' }} aria-label="(on)" />}
              </button>
            ))}
          </div>

          <div role="tabpanel" key={tab} className="fade min-w-0 flex-1 overflow-y-auto px-3 py-2">
            {tab === 'sort' && SORTS.map(([v, l]) => <Opt key={v} on={s === v} onPick={() => setS(v)} label={l} />)}
            {tab === 'cat' && ['All', ...CATEGORIES].map(c => (
              <Opt key={c} on={d.cat === c} onPick={() => set({ cat: c })} label={c === 'All' ? 'All categories' : c}
                sub={c === 'All' ? `${places.length} places` : `${catCount(c)} places`} />
            ))}
            {tab === 'city' && ['All', ...cities].map(c => (
              <Opt key={c} on={d.city === c} onPick={() => set({ city: c })} label={c === 'All' ? 'All cities' : c} />
            ))}
            {tab === 'price' && (
              <div className="px-2 pt-2">
                <p className="m-0 text-sm" style={{ color: 'var(--mute)' }}>Show places with a dish up to</p>
                <p className="m-0 mt-1 text-2xl font-extrabold" style={{ color: 'var(--pri)' }}>{priceOn ? `₹${d.maxPrice}` : 'Any price'}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[100, 200, 500].filter(v => v < scale.cap).map(v => (
                    <button key={v} className={`chip ${d.maxPrice === v ? 'on' : ''}`} onClick={() => set({ maxPrice: d.maxPrice === v ? null : v })}>Under ₹{v}</button>
                  ))}
                </div>
                <div className="mt-4"><PriceSlider places={places} scale={scale} maxPrice={d.maxPrice} onChange={v => set({ maxPrice: v })} /></div>
              </div>
            )}
            {tab === 'rating' && [[0, 'Any rating'], [4, 'Dishes rated 4★ & up'], [5, 'Only 5★ dishes']].map(([v, l]) => (
              <Opt key={v} on={d.minRate === v} onPick={() => set({ minRate: v })} label={l} />
            ))}
            {tab === 'more' && (
              <Opt box on={d.again} onPick={() => set({ again: !d.again })} label="Order again" sub="Only dishes you said you'd order again" />
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 border-t px-5 pb-[calc(14px+env(safe-area-inset-bottom,0px))] pt-3" style={{ borderColor: 'var(--line)' }}>
          <button className="tbtn text-[15px] font-bold" style={{ color: activeFilterCount(d, scale.cap) || s !== 'recent' ? 'var(--bad)' : 'var(--faint)' }}
            onClick={() => { setD({ ...NO_FILTERS, q: d.q }); setS('recent') }}>Clear all</button>
          <button className="btn btn-pri flex-1" disabled={!count} onClick={() => onApply(d, s)}>
            {count ? `Show ${count} ${count === 1 ? 'place' : 'places'}` : 'No places match'}
          </button>
        </div>
      </section>
    </>
  )
}
