import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import BillViewer from './BillViewer'
import { loadBills, deleteBill } from './billApi'
import { canDeleteBill } from './billPhoto'

const day = iso => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

// The 🧾 button on a place card: fetches that place's bill photos (newest first) and shows them.
export default function PlaceBills({ place, me, isOwner, names = {}, onClose, onChanged }) {
  const [bills, setBills] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    loadBills(place.id).then(setBills).catch(err => setError(err.message || 'Could not load the bill.'))
  }, [place.id])

  async function remove(photo) {
    await deleteBill(photo.id)
    const left = bills.filter(b => b.id !== photo.id)
    setBills(left)
    onChanged()
    if (!left.length) onClose()
  }

  if (bills?.length) {
    const photos = bills.map(b => ({
      id: b.id,
      src: b.image,
      canDelete: canDeleteBill(b, me, isOwner),
      caption: `${place.name} · ${day(b.created_at)}` +
        (place.group_id ? ` · added by ${b.user_id === me ? 'you' : names[b.user_id] || 'a member'}` : ''),
    }))
    return <BillViewer photos={photos} onClose={onClose} onDelete={remove} />
  }

  // loading / error / (just deleted elsewhere) — same dark sheet the viewer uses, so nothing flashes
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Bill photo" className="fade fixed inset-0 z-50 grid place-items-center p-6 text-center text-sm text-white"
      style={{ background: '#0f172ae6' }} onMouseDown={onClose}>
      {error ? <p>{error} Tap anywhere to close.</p> : bills ? <p>No bill photo here any more.</p> : (
        <div className="w-48"><p className="mb-3">Opening bill…</p><div className="scanbar" aria-hidden="true" /></div>
      )}
    </div>,
    document.body,
  )
}
