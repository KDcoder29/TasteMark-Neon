import { useState } from 'react'
import Icon from './Icons'
import { useEscape } from './layers'
import { supabase } from './supabase'
import { addDishWithRating } from './groupApi'
import { norm, priceInput, priceProps, StarPicker, OrderAgain } from './shared'

// Add a dish (with my rating) to a place that is already in the group.
// If the dish already exists there, my rating is added to it.
export default function DishForm({ me, place, onClose, onSaved }) {
  useEscape(onClose)
  const [f, setF] = useState({ name: '', price: '', rating: 0, order_again: '', note: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const mute = { color: 'var(--mute)' }
  const label = 'mb-1 block text-xs font-medium'

  const existing = (place.dishes || []).find(d => norm(d.name) === norm(f.name))
  const set = (k, v) => setF({ ...f, [k]: v })

  async function save(e) {
    e.preventDefault()
    if (!f.name.trim()) return setError('Enter the dish name.')
    if (!existing && f.price === '') return setError('Enter the price.')
    if (!f.rating) return setError('Give the dish a star rating.')
    setBusy(true); setError('')
    try {
      // re-read the place's dishes so a dish a friend just added is not duplicated
      const { data, error: e1 } = await supabase.from('dishes').select('id, name, dish_ratings(user_id)').eq('place_id', place.id)
      if (e1) throw e1
      await addDishWithRating(place.id, f, me, data, { overwrite: true })
      onSaved()
    } catch (err) {
      setError(err.message || 'Could not save. Please try again.')
      setBusy(false)
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Add a dish" className="fade fixed inset-0 z-[45] grid place-items-center overflow-y-auto p-4" style={{ background: '#0b120f80', backdropFilter: 'blur(3px)' }}
      onMouseDown={e => e.target === e.currentTarget && !busy && onClose()}>
      <form onSubmit={save} className="sheet w-full max-w-sm rounded-3xl p-5 shadow-2xl" style={{ background: 'var(--surface)' }}>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-bold">Add a dish</h2>
          <button type="button" onClick={onClose} className="ghost grid h-8 w-8 place-items-center rounded-full" style={mute} aria-label="Close"><Icon name="x" size={18} /></button>
        </div>
        <p className="mb-4 text-sm" style={mute}>at <b style={{ color: 'var(--ink)' }}>{place.name}</b></p>

        <label className={label} style={mute}>Dish name *</label>
        <input autoFocus list="dishnames" value={f.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Hazelnut cold coffee" className="input mb-1" />
        <datalist id="dishnames">{(place.dishes || []).map(d => <option key={d.id} value={d.name} />)}</datalist>
        {existing
          ? <p className="mb-3 text-xs" style={{ color: 'var(--ok)' }}>This dish is already here, so your rating will be added to it.</p>
          : <div className="mb-3" />}

        {!existing && (
          <>
            <label className={label} style={mute}>Price ₹ *</label>
            <input {...priceProps} value={f.price} onChange={e => set('price', priceInput(e.target.value))} placeholder="200" className="input mb-3" />
          </>
        )}

        <div className="mb-1 flex items-center justify-between gap-3">
          <span className="text-[13px] font-semibold" style={mute}>Your rating *</span>
          <StarPicker value={f.rating} onChange={n => set('rating', n)} />
        </div>
        <div className="mb-3"><OrderAgain value={f.order_again} onChange={v => set('order_again', v)} /></div>

        <input value={f.note} onChange={e => set('note', e.target.value)} placeholder="Your take (optional)" className="input mb-4" />

        {error && <p className="fade mb-3 rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--errbg)', color: 'var(--bad)' }}>{error}</p>}
        <button disabled={busy} className="btn btn-pri w-full">{busy ? 'Saving…' : existing ? 'Add my rating' : 'Add dish'}</button>
      </form>
    </div>
  )
}
