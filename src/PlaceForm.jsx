import { useState } from 'react'
import Icon from './Icons'
import { useEscape } from './layers'
import { supabase } from './supabase'
import { CATEGORIES, priceInput, priceProps, StarPicker, OrderAgain, GroupBadge } from './shared'
import { findGroupPlace, addDishWithRating } from './groupApi'
import { blankDish, mergeScannedDishes, mergeSpokenDishes, newScannedDishes, placeFormError } from './placeRules'
import VoiceAdd from './VoiceAdd'
import BillScan from './BillScan'
import { saveBills } from './billApi'

// place      = existing place being edited (null when adding)
// prefill    = starting values when adding from the wishlist; wishId = that wishlist item
// groups     = my groups; defaultGroupId = the open space ('' = Personal)
// initialBill = a bill photo picked from the + menu; it is scanned as soon as the form opens
// initialVoice = opened with "Say it" from the + menu: start listening at once
// knownPlaces = my personal places (voice: "Sankalp" -> offer to add to that card, no duplicate)
export default function PlaceForm({ me, place, cities, groups = [], defaultGroupId = '', prefill, wishId, initialBill, initialVoice, knownPlaces = [], onUseExisting, onClose, onSaved }) {
  useEscape(onClose)
  const editing = !!place
  const editingGroup = editing && !!place.group_id
  const start = place || prefill || {}

  const [f, setF] = useState({
    name: start.name || '', city: start.city || '', area: start.area || '', directions: start.directions || '',
  })
  const [dishes, setDishes] = useState(
    editing && place.dishes?.length
      ? place.dishes.map(d => ({ name: d.name, price: d.price ?? '', rating: d.rating || 0, order_again: d.order_again || '', note: d.note || '' }))
      : [blankDish()])
  const [cats, setCats] = useState(start.categories || [])
  const [target, setTarget] = useState(defaultGroupId)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [billFiles, setBillFiles] = useState([])   // bill photos scanned here, saved with the place
  const [existing, setExisting] = useState(null)   // voice named a place already in the journal
  const toggleCat = c => setCats(cats.includes(c) ? cats.filter(x => x !== c) : [...cats, c])

  const setField = k => e => setF({ ...f, [k]: e.target.value })
  const setDish = (i, k, v) => setDishes(dishes.map((d, j) => (j === i ? { ...d, [k]: v } : d)))

  // what was said -> the form. The place name is only filled when empty; a place you already have
  // also brings its city, area and categories, and is offered as "add these dishes there instead".
  function spoken({ place: said, dishes: heard }) {
    const match = said && knownPlaces.find(p => p.name.trim().toLowerCase() === said.trim().toLowerCase())
    if (said && !f.name.trim()) {
      setF(v => ({ ...v, name: match?.name || said, city: v.city || match?.city || '', area: v.area || match?.area || '' }))
      if (match && !cats.length) setCats(match.categories || [])
    }
    setDishes(ds => mergeSpokenDishes(ds, heard))
    setExisting(!editing && !target && match ? match : null)
  }

  async function save(e) {
    e.preventDefault()
    const bad = placeFormError({ f, cats, dishes, editingGroup })
    setError(bad)
    if (bad) return
    setBusy(true)
    let savedId = editing ? place.id : null
    try {
      const clean = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim() || null]))
      clean.categories = cats

      if (editing) {
        const { error: e1 } = await supabase.from('places').update(clean).eq('id', place.id)
        if (e1) throw e1
        if (!editingGroup) {                       // personal place: dishes are edited here
          await supabase.from('dishes').delete().eq('place_id', place.id)
          const rows = dishes.filter(d => d.name.trim()).map(d => ({
            place_id: place.id, name: d.name.trim(), price: d.price === '' ? null : +d.price,
            rating: d.rating || null, order_again: d.order_again || null, note: d.note.trim() || null,
          }))
          if (rows.length) { const { error: e2 } = await supabase.from('dishes').insert(rows); if (e2) throw e2 }
        }
      } else if (target) {
        // GROUP: reuse the group's card for this place if it already exists
        let existing = await findGroupPlace(target, f.name, f.city)
        let placeId = existing?.id
        let created = false
        if (!placeId) {
          const { data, error: e1 } = await supabase.from('places').insert({ ...clean, group_id: target }).select('id').single()
          if (e1) throw e1
          placeId = data.id; created = true
        }
        savedId = placeId
        const known = existing ? [...existing.dishes] : []
        let saved = 0
        try {
          for (const d of dishes.filter(x => x.name.trim())) {
            const r = await addDishWithRating(placeId, d, me, known, { overwrite: true })
            saved++
            if (!known.some(k => k.id === r.dishId)) known.push({ id: r.dishId, name: d.name, dish_ratings: [{ user_id: me }] })
          }
        } catch (err) {
          if (created && saved === 0) await supabase.from('places').delete().eq('id', placeId)  // no empty place left behind
          throw err
        }
      } else {
        // PERSONAL
        const { data, error: e1 } = await supabase.from('places').insert({ ...clean, group_id: null }).select('id').single()
        if (e1) throw e1
        savedId = data.id
        const rows = dishes.filter(d => d.name.trim()).map(d => ({
          place_id: data.id, name: d.name.trim(), price: d.price === '' ? null : +d.price,
          rating: d.rating || null, order_again: d.order_again || null, note: d.note.trim() || null,
        }))
        if (rows.length) { const { error: e2 } = await supabase.from('dishes').insert(rows); if (e2) throw e2 }
      }

      if (wishId) await supabase.from('wishlist').update({ went_at: new Date().toISOString() }).eq('id', wishId)
      // the place is saved either way; a failed bill upload must not undo it
      try { await saveBills(savedId, billFiles) }
      catch (err) { console.error(err); alert('The place was saved, but the bill photo could not be saved: ' + (err.message || 'unknown error')) }
      setBusy(false)
      onSaved()
    } catch (err) {
      setBusy(false)
      alert(err.message || 'Could not save. Please try again.')
    }
  }

  async function remove() {
    const msg = editingGroup
      ? `Delete "${place.name}" with all its dishes, ratings and comments for everyone in the group?`
      : `Delete "${place.name}" and all its dishes?`
    if (!confirm(msg)) return
    const { error: err } = await supabase.from('places').delete().eq('id', place.id)
    if (err) return alert(err.message)
    onSaved()
  }

  const label = 'mb-1 block text-xs font-medium'
  const mute = { color: 'var(--mute)' }
  const title = editing ? 'Edit place' : wishId ? 'We went! Add your visit' : 'Add place'

  return (
    <>
    <div className="scrim" onMouseDown={onClose} />
    <form onSubmit={save} className="drawer" role="dialog" aria-modal="true" aria-label={title}>
      <div className="grabber" />
      <div className="flex-1 overflow-y-auto px-5 pb-8 pt-2 lg:pt-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="m-0 text-xl font-extrabold">{title}</h2>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full ghost transition" style={mute} aria-label="Close"><Icon name="x" size={18} /></button>
        </div>

        {!editing && groups.length > 0 && (
          <div className="mb-3">
            <label className={label} style={mute}>Save to</label>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Save to">
              <button type="button" role="radio" aria-checked={!target} className={`chip ${!target ? 'on' : ''}`} onClick={() => setTarget('')}>
                <Icon name="user" size={15} /> Personal
              </button>
              {groups.map(g => (
                <button key={g.id} type="button" role="radio" aria-checked={target === g.id} className={`chip ${target === g.id ? 'on' : ''}`} onClick={() => setTarget(g.id)}>
                  <GroupBadge g={g} size={18} /> {g.name}
                </button>
              ))}
            </div>
            {target && <p className="mt-1 text-xs" style={mute}>If this place is already in the group, your dishes and ratings are added to the existing card.</p>}
          </div>
        )}

        {!editingGroup && <VoiceAdd auto={initialVoice} knownPlaces={knownPlaces.map(p => p.name)} onResult={spoken} />}
        {existing && onUseExisting && (
          <div className="fade mb-4 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm" style={{ background: 'var(--accent-soft)' }}>
            <p className="m-0 flex-1"><b>{existing.name}</b> is already in your journal.</p>
            <button type="button" className="btn btn-pri !px-3 !py-1.5 !text-sm"
              onClick={() => onUseExisting(existing, dishes.filter(d => String(d.name).trim()))}>Add dishes there</button>
          </div>
        )}

        <label className={label} style={mute}>Place name *</label>
        <input required autoFocus={!initialVoice} placeholder="e.g. Coffea: Brew on the Rocks" value={f.name} onChange={setField('name')} className="input mb-3" />
        <div className="mb-3 grid grid-cols-2 gap-2">
          <div><label className={label} style={mute}>City *</label>
            <input required list="cities" placeholder="Vadodara" value={f.city} onChange={setField('city')} className="input" /></div>
          <div><label className={label} style={mute}>Area / landmark *</label>
            <input required placeholder="13 Canal Rd" value={f.area} onChange={setField('area')} className="input" /></div>
        </div>
        <label className={label} style={mute}>Category * <span className="font-normal">(pick one or more)</span></label>
        <div className="mb-3 flex flex-wrap gap-2">
          {CATEGORIES.map(c => (
            <button key={c} type="button" onClick={() => toggleCat(c)} className={`chip ${cats.includes(c) ? 'on' : ''}`}>{c}</button>
          ))}
        </div>
        <label className={label} style={mute}>Directions / timing</label>
        <textarea rows={2} placeholder="Optional" value={f.directions} onChange={setField('directions')} className="input mb-5" />
        <datalist id="cities">{cities.map(c => <option key={c} value={c} />)}</datalist>

        {editingGroup ? (
          <p className="mb-5 rounded-xl px-3 py-2.5 text-sm" style={{ background: 'var(--bg)', color: 'var(--mute)' }}>
            Dishes in a group are added, rated and edited from the place card, so everyone keeps their own rating.
          </p>
        ) : (
          <>
            <h3 className="mb-2 text-sm font-semibold">Dishes</h3>
            <BillScan initialFile={initialBill} onPhoto={file => setBillFiles(b => [...b, file])} onDishes={found => {
              const fresh = newScannedDishes(dishes, found)
              setDishes(mergeScannedDishes(dishes, fresh))
              return fresh.length
            }} />
            {dishes.map((d, i) => (
              <div key={i} className="rise mb-3 rounded-2xl border p-3" style={{ borderColor: 'var(--line)', background: 'var(--dish)' }}>
                <div className="mb-2 flex gap-2">
                  <input required placeholder="Dish name *" value={d.name} onChange={e => setDish(i, 'name', e.target.value)} className="input" />
                  <input required {...priceProps} placeholder="Price ₹ *" value={d.price} onChange={e => setDish(i, 'price', priceInput(e.target.value))} className="input !w-28" />
                </div>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="text-[13px] font-semibold" style={mute}>Your rating *</span>
                  <StarPicker value={d.rating} onChange={n => setDish(i, 'rating', n)} />
                </div>
                <div className="mb-2.5"><OrderAgain value={d.order_again} onChange={v => setDish(i, 'order_again', v)} /></div>
                <input required placeholder="Your comment *" aria-label="Your comment" value={d.note} onChange={e => setDish(i, 'note', e.target.value)} className="input" />
                {dishes.length > 1 && (
                  <button type="button" onClick={() => setDishes(dishes.filter((_, j) => j !== i))}
                    className="mt-2 text-xs font-medium" style={{ color: 'var(--bad)' }}>Remove dish</button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => setDishes([...dishes, blankDish()])}
              className="mb-5 text-sm font-semibold" style={{ color: 'var(--pri)' }}>+ Add another dish</button>
          </>
        )}

        {error && <p className="fade mb-3 rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--errbg)', color: 'var(--bad)' }}>{error}</p>}
        <div className="flex gap-2">
          <button disabled={busy} className="btn btn-pri flex-1">{busy ? 'Saving…' : 'Save'}</button>
          {editing && <button type="button" onClick={remove} className="btn" style={{ color: 'var(--bad)' }}>Delete</button>}
        </div>
      </div>
    </form>
    </>
  )
}
