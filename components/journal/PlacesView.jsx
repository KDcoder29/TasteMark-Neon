'use client'
import { SORTS } from '@/lib/journalFilter'
import ChipSelect from '@/components/ui/ChipSelect'
import PlaceCard from '@/components/place/PlaceCard'
import Icon from '@/components/ui/Icons'
import { CATEGORIES, PriceSlider } from '@/components/ui/shared'
import { useApp } from '@/components/app/AppProvider'
import { useSpace } from '@/components/journal/SpaceProvider'
import Link from 'next/link'
import { viewHref } from '@/lib/routes'
import { navLink } from '@/components/app/Shell'

// Places: the space's journal with search, filters and sort (the / and /g/[groupId] pages).
export default function PlacesView() {
  const { setHelp: onHelp } = useApp()
  const { group, me, places, names, loading, netErr, reload: load, seed, q, setQ, city, setCity, cat, setCat, minRate, setMinRate,
    maxPrice, setMaxPrice, again, setAgain, sort, setSort: chooseSort, reset, dirty, priceOn, priceLabel, priceOpen, setPriceOpen,
    setSheetTab, scale, sorted, cities, nActive, searching, openPlace, setAsking, setPicking } = useSpace()
  const mute = { color: 'var(--mute)' }
  const toggle = (on, set) => set(!on)
  return (
        <>
          {/* quick tools: in the sidebar on laptops */}
          <div className="mobile-only mb-4 grid grid-cols-2 gap-2.5">
            <button className="quick" onClick={() => setAsking(true)}>
              <span className="qicon" style={{ background: 'var(--pri-soft)', color: 'var(--pri)' }}><Icon name="chat" /></span>
              <span className="min-w-0 text-[13px] leading-tight"><b className="block text-[14px]">Craving?</b><span style={mute}>Ask your journal</span></span>
            </button>
            <button className="quick" onClick={() => setPicking(true)}>
              <span className="qicon" style={{ background: 'var(--accent-soft)', color: 'var(--accent-ink)' }}><Icon name="dice" /></span>
              <span className="min-w-0 text-[13px] leading-tight"><b className="block text-[14px]">Where to eat?</b><span style={mute}>Pick for me</span></span>
            </button>
            {/* a Link (prefetched in full) so Near me opens without the server, offline too */}
            <Link href={viewHref('near', group?.id)} {...navLink} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="quick col-span-2 !py-2.5">
              <span className="qicon !h-9 !w-9" style={{ background: 'var(--near-soft)', color: 'var(--near-ink)' }}><Icon name="locate" /></span>
              <span className="min-w-0 flex-1 text-[13px] leading-tight"><b className="block text-[14px]">Near me</b><span style={mute}>Your places around you, on a map</span></span>
              <Icon name="chevron" size={18} style={mute} />
            </Link>
          </div>

          {/* ---------- search + filters ---------- */}
          <div className="sticky top-[61px] z-10 -mx-4 bg-[var(--bg)] px-4 pb-3 pt-1 lg:static lg:mx-0 lg:px-0">
            <label className="searchbar">
              <Icon name="search" size={19} style={mute} />
              <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search a dish, place, area or note…" aria-label="Search" />
              {q && <button onClick={() => setQ('')} aria-label="Clear search" className="ghost grid h-7 w-7 place-items-center rounded-full" style={mute}><Icon name="x" size={15} /></button>}
            </label>

            {/* phones: one tidy row + a filter sheet (Zomato / Swiggy pattern) */}
            <div className="mobile-only mt-3 flex items-center gap-2">
              <button className={`chip ${nActive ? 'on' : ''}`} onClick={() => setSheetTab('cat')} aria-label={`Filters${nActive ? `, ${nActive} on` : ''}`}>
                <Icon name="sliders" size={15} /> Filters
                {nActive > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold" style={{ background: 'var(--pri)', color: 'var(--on-pri)' }}>{nActive}</span>}
              </button>
              <button className={`chip ${sort !== 'recent' ? 'on' : ''}`} onClick={() => setSheetTab('sort')}>
                {SORTS.find(([v]) => v === sort)?.[1]} <Icon name="down" size={14} />
              </button>
              <button className={`chip ${again ? 'on' : ''}`} aria-pressed={again} onClick={() => setAgain(!again)}>
                {again && <Icon name="check" size={14} stroke={2.8} />} Order again
              </button>
            </div>
            {nActive > 0 && (
              <div className="mobile-only mt-2.5 flex flex-wrap gap-1.5">
                {[
                  city !== 'All' && [city, () => setCity('All')],
                  cat !== 'All' && [cat, () => setCat('All')],
                  priceOn && [`Under ₹${maxPrice}`, () => setMaxPrice(null)],
                  minRate > 0 && [minRate === 5 ? '5★ dishes' : `${minRate}★ & up`, () => setMinRate(0)],
                  again && ['Order again', () => setAgain(false)],
                ].filter(Boolean).map(([label, off]) => (
                  <button key={label} onClick={off} className="fade inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
                    style={{ background: 'var(--pri-soft)', color: 'var(--pri)' }} aria-label={`Remove filter ${label}`}>
                    {label} <Icon name="x" size={12} stroke={2.6} />
                  </button>
                ))}
                <button onClick={() => { reset(); setPriceOpen(false) }} className="px-1.5 py-1 text-xs font-semibold" style={mute}>Clear all</button>
              </div>
            )}

            {/* laptops: everything visible as chips */}
            <div className="desktop-only mt-3 flex flex-wrap gap-2">
              <ChipSelect icon="sliders" label="Sort places" value={sort} options={SORTS} onChange={chooseSort} active={sort !== 'recent'} />
              {cities.length > 1 && (
                <ChipSelect icon="pin" label="City" value={city} onChange={setCity} active={city !== 'All'}
                  options={[['All', 'All cities'], ...cities.map(c => [c, c])]} />
              )}
              {CATEGORIES.map(c => (
                <button key={c} className={`chip ${cat === c ? 'on' : ''}`} aria-pressed={cat === c} onClick={() => setCat(cat === c ? 'All' : c)}>{c}</button>
              ))}
              <button className={`chip ${minRate === 4 ? 'on' : ''}`} aria-pressed={minRate === 4} onClick={() => setMinRate(minRate === 4 ? 0 : 4)}>4★ & up</button>
              <button className={`chip ${again ? 'on' : ''}`} aria-pressed={again} onClick={() => toggle(again, setAgain)}>Order again</button>
              <button className={`chip ${priceOn || priceOpen ? 'on' : ''}`} aria-expanded={priceOpen} onClick={() => setPriceOpen(!priceOpen)}>
                {priceLabel} <Icon name="down" size={14} style={{ transform: priceOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
              </button>
              {dirty && <button className="chip fade" onClick={() => { reset(); setPriceOpen(false) }}><Icon name="x" size={14} /> Clear</button>}
            </div>

            {priceOpen && (
              <div className="desktop-only sheet mt-3 max-w-xl rounded-2xl border px-4 pb-2 pt-3" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">Max price per dish</span>
                  <span className="font-bold" style={{ color: 'var(--pri)' }}>{priceOn ? '₹' + maxPrice : 'Any'}</span>
                </div>
                <PriceSlider places={places} scale={scale} maxPrice={maxPrice} onChange={setMaxPrice} />
              </div>
            )}
          </div>

          {!loading && places.length > 0 && (
            <p className="mb-3 mt-1 text-[13px] font-semibold" style={mute}>
              {sorted.length === places.length ? `${places.length} places` : `${sorted.length} of ${places.length} places`}
            </p>
          )}

          {netErr && (
            <div className="fade mb-3 flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm" role="status" style={{ background: 'var(--errbg)', color: 'var(--bad)' }}>
              <span className="flex-1">{netErr} {places.length ? 'Showing your journal from this device.' : "Couldn't load your journal."}</span>
              <button className="font-semibold underline" onClick={load}>Try again</button>
            </div>
          )}

          {loading ? (
            <div className="place-grid">{[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="skel !h-[104px]" />)}</div>
          ) : places.length === 0 && netErr ? null : places.length === 0 ? (
            <div className="rise py-16 text-center">
              <span className="qicon mx-auto mb-4 !h-16 !w-16" style={{ background: 'var(--accent-soft)', color: 'var(--accent-ink)' }}><Icon name="receipt" size={30} /></span>
              <p className="m-0 text-lg font-bold">{group ? `${group.name} has no places yet` : 'Your journal is empty'}</p>
              <p className="mx-auto mb-5 mt-1 max-w-xs text-sm" style={mute}>Tap + to scan a bill, say it, or add your first place by hand.</p>
              <div className="mb-4 flex flex-wrap justify-center gap-2">
                <button className="btn btn-pri !py-2 !text-sm" onClick={() => onHelp('tour')}><Icon name="play" size={16} /> Play the 1-minute tour</button>
                <button className="btn !py-2 !text-sm" onClick={() => onHelp('guide')}><Icon name="help" size={16} /> See all features</button>
              </div>
              {!group && <button onClick={seed} className="tbtn text-sm font-semibold" style={{ color: 'var(--pri)' }}>or load sample data</button>}
            </div>
          ) : sorted.length === 0 ? (
            <div className="fade py-16 text-center" style={mute}>
              <p className="m-0 font-semibold" style={{ color: 'var(--ink)' }}>Nothing matches</p>
              <p className="m-0 mt-1 text-sm">Try fewer filters or a different word.</p>
              <button className="btn mt-4 !py-2 !text-sm" onClick={() => { reset(); setPriceOpen(false) }}>Clear filters</button>
            </div>
          ) : (
            <div className="place-grid">
              {sorted.map((p, i) => (
                <PlaceCard key={p.id} p={p} index={i} group={group} me={me} names={names}
                  searching={searching || minRate > 0 || again || priceOn} onOpen={() => openPlace(p.id)} />
              ))}
            </div>
          )}
        </>
  )
}
