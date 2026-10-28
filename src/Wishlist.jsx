import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { CATEGORIES } from './shared'
import Icon from './Icons'
import Toast from './Toast'
import { tileColor } from './PlaceCard'
import { placeWhere } from './placeView'
import { createUndo } from './undo'
import { MapsButton, MapsWhere } from './MapsLinkField'
import { isMapsLink } from './mapsLink'
import { MAPS_HINT } from './placeRules'
import { skipUnknownMaps } from './mapsSave'
import { showAlert } from './dialogs'
import LocationField from './LocationField'
import { locationRow, wantsAreaLookup } from './locationValue'
import { autoLocate } from './autoLocate'
import { useLocationReady } from './locationReady'

const EMPTY = { name: '', city: '', area: '', note: '', maps_url: '' }

// "Want to try" list. In a group everybody sees it; in Personal only you do.
// Remove is instant with a 5-second Undo (no "are you sure?" box); the real delete happens after.
export default function Wishlist({ me, group, items, names, isOwner, onChanged, onWent }) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState(EMPTY)
  const [cats, setCats] = useState([])
  const [loc, setLoc] = useState(null)               // position or null
  const locReady = useLocationReady({ strict: true })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [leaving, setLeaving] = useState(null)       // id of the card sliding out
  const [gone, setGone] = useState(null)             // removed, waiting for Undo
  const changed = useRef(onChanged)
  changed.current = onChanged
  const undo = useRef(null)
  if (!undo.current) undo.current = createUndo({
    onChange: setGone,
    commit: async item => {
      const { error: err } = await supabase.from('wishlist').delete().eq('id', item.id)
      if (err) showAlert({ title: 'Couldn’t remove it', message: err.message })
      changed.current()
    },
  })
  useEffect(() => () => undo.current.flush(), [])    // leaving the tab: delete what's waiting now

  const mute = { color: 'var(--mute)' }
  const label = 'mb-1 block text-xs font-medium'

  const setField = k => e => setF({ ...f, [k]: e.target.value })
  const toggleCat = c => setCats(cats.includes(c) ? cats.filter(x => x !== c) : [...cats, c])

  async function add(e) {
    e.preventDefault()
    if (!f.name.trim()) return setError('Enter the place name.')
    if (f.maps_url.trim() && !isMapsLink(f.maps_url.trim())) return setError(MAPS_HINT)
    setBusy(true); setError('')
    const row = {
      name: f.name.trim(), city: f.city.trim() || null, area: f.area.trim() || null,
      note: f.note.trim() || null, categories: cats, group_id: group?.id ?? null,
    }
    if (f.maps_url.trim()) row.maps_url = f.maps_url.trim()
    Object.assign(row, locationRow(loc, false))
    const { data: added, error: err } = await skipUnknownMaps(r => supabase.from('wishlist').insert(r).select('id').single(), row)
    setBusy(false)
    if (err) return setError(err.message)
    if (locReady && added?.id && wantsAreaLookup(loc, null, f)) autoLocate([{ table: 'wishlist', id: added.id, name: f.name, area: f.area, city: f.city }], { now: true })
    setF(EMPTY); setCats([]); setLoc(null); setOpen(false)
    onChanged()
  }

  function remove(item) {
    setLeaving(item.id)
    setTimeout(() => { setLeaving(null); undo.current.remove(item) }, 180)
  }

  const shown = items.filter(w => w.id !== gone?.id)

  return (
    <div>
      {!open ? (
        <button onClick={() => setOpen(true)} className="btn mb-4 w-full !border-dashed" style={{ color: 'var(--pri)' }}>
          <Icon name="plus" size={18} stroke={2.4} /> Add a place to try
        </button>
      ) : (
        <form onSubmit={add} className="sheet card mb-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="m-0 font-bold">Place to try</h3>
            <button type="button" onClick={() => { setOpen(false); setError('') }} aria-label="Close" className="ghost grid h-8 w-8 place-items-center rounded-full" style={mute}><Icon name="x" size={17} /></button>
          </div>
          <label className={label} style={mute}>Place name *</label>
          <input autoFocus value={f.name} onChange={setField('name')} placeholder="e.g. Brew on the Rocks" className="input mb-2" />
          <div className="mb-2 grid grid-cols-2 gap-2">
            <div><label className={label} style={mute}>City</label><input value={f.city} onChange={setField('city')} placeholder="Vadodara" className="input" /></div>
            <div><label className={label} style={mute}>Area</label><input value={f.area} onChange={setField('area')} placeholder="Alkapuri" className="input" /></div>
          </div>
          <div className="mb-2 flex flex-wrap gap-2">
            {CATEGORIES.map(c => <button key={c} type="button" onClick={() => toggleCat(c)} className={`chip ${cats.includes(c) ? 'on' : ''}`}>{c}</button>)}
          </div>
          <input value={f.note} onChange={setField('note')} placeholder="Why? (optional, e.g. Riya recommended it)" className="input mb-3" />
          <LocationField value={loc} onChange={setLoc} place={f} onLink={l => setF(x => ({ ...x, maps_url: l }))} />
          {error && <p className="fade mb-3 rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--errbg)', color: 'var(--bad)' }}>{error}</p>}
          <button disabled={busy} className="btn btn-pri w-full">{busy ? 'Adding…' : 'Add to Want to try'}</button>
        </form>
      )}

      {shown.length === 0 ? (
        <div className="rise py-12 text-center">
          <span className="qicon mx-auto mb-4 !h-16 !w-16" style={{ background: 'var(--pri-soft)', color: 'var(--pri)' }}><Icon name="bookmark" size={28} /></span>
          <p className="m-0 text-lg font-bold">Nothing to try yet</p>
          <p className="mx-auto mt-1 max-w-xs text-sm" style={mute}>Save places you want to visit. When you go, tap "We went" to turn one into a journal entry.</p>
        </div>
      ) : (
        <div className="place-grid">
          {shown.map((w, i) => {
            const where = placeWhere(w)
            return (
              <article key={w.id} className={`wcard rise ${leaving === w.id ? 'out' : ''}`} style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                <div className="flex gap-3.5">
                  <span className="mono h-12 w-12 text-lg" style={{ background: tileColor(w) }}>{w.name.trim()[0]?.toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="m-0 text-[16px] font-bold leading-snug">{w.name}</h3>
                      {(w.categories || []).length > 0 && <span className="flex shrink-0 gap-1">{w.categories.map(c => <span key={c} className="pill">{c}</span>)}</span>}
                    </div>
                    {where && <p className="m-0 mt-0.5 text-[13px]" style={mute}><MapsWhere place={w} where={where} size={13} /></p>}
                    {w.note && <p className="wnote">{w.note}</p>}
                    {group && <p className="m-0 mt-1.5 text-xs" style={mute}>Added by {w.user_id === me ? 'you' : (names[w.user_id] || 'a member')}</p>}
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button onClick={() => onWent(w)} className="btn btn-pri !px-3.5 !py-2 !text-sm"><Icon name="check" size={16} stroke={2.6} /> We went</button>
                  <MapsButton place={w} className="!px-3.5 !py-2 !text-sm" />
                  {(w.user_id === me || isOwner) && (
                    <button onClick={() => remove(w)} aria-label={`Remove ${w.name}`} className="ghost ml-auto grid h-9 w-9 place-items-center rounded-full" style={mute}>
                      <Icon name="trash" size={18} />
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}

      {gone && <Toast key={gone.id} text={`Removed ${gone.name}`} action="Undo" onAction={() => undo.current.undo()} />}
    </div>
  )
}
