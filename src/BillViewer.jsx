import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useEscape } from './layers'

// Full-screen bill photo(s): zoom, "1 of 2" arrows, and delete for whoever may delete.
// photos = [{ id, src, caption, canDelete }]. Esc / tap outside closes; ← → move between bills.
// Rendered into <body>: inside the place form, the form's slide-in transform made `fixed` mean
// "form-sized" and drew the form's fields on top of the photo.
export default function BillViewer(props) {
  return createPortal(<Panel {...props} />, document.body)
}

const glass = { background: '#ffffff1f' }

function Panel({ photos, onClose, onDelete }) {
  const [i, setI] = useState(0)
  const [zoom, setZoom] = useState(false)
  const [busy, setBusy] = useState(false)
  const n = photos.length
  const at = Math.min(i, n - 1)
  const photo = photos[at]
  const go = d => { setZoom(false); setI((at + d + n) % n) }

  useEscape(onClose)
  useEffect(() => {
    const key = e => {
      if (n > 1 && e.key === 'ArrowRight') go(1)
      else if (n > 1 && e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', key, true)
    return () => window.removeEventListener('keydown', key, true)
  })

  async function remove() {
    if (!confirm('Delete this bill photo? This cannot be undone.')) return
    setBusy(true)
    try { await onDelete(photo) } catch (err) { alert(err.message || 'Could not delete the bill.') }
    setBusy(false)
  }

  if (!photo) return null
  return (
    <div role="dialog" aria-modal="true" aria-label="Bill photo" className="fade fixed inset-0 z-50 flex flex-col text-white"
      style={{ background: '#0f172ae6' }} onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
        <button type="button" onClick={() => setZoom(!zoom)} className="rounded-full px-3 py-1.5 font-semibold" style={glass}>
          {zoom ? 'Fit to screen' : 'Zoom in'}
        </button>
        {n > 1 && (
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => go(-1)} aria-label="Previous bill" className="grid h-8 w-8 place-items-center rounded-full text-lg" style={glass}>‹</button>
            <span className="min-w-14 text-center font-semibold tabular-nums">{at + 1} of {n}</span>
            <button type="button" onClick={() => go(1)} aria-label="Next bill" className="grid h-8 w-8 place-items-center rounded-full text-lg" style={glass}>›</button>
          </div>
        )}
        <div className="flex items-center gap-2">
          {onDelete && photo.canDelete && (
            <button type="button" onClick={remove} disabled={busy} aria-label="Delete this bill"
              className="grid h-9 w-9 place-items-center rounded-full disabled:opacity-50" style={glass}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
              </svg>
            </button>
          )}
          <button type="button" onClick={onClose} aria-label="Close bill photo" autoFocus
            className="grid h-9 w-9 place-items-center rounded-full text-xl" style={glass}>×</button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-3" onMouseDown={e => e.target === e.currentTarget && onClose()}>
        <img key={photo.id} src={photo.src} alt="Bill" onClick={() => setZoom(!zoom)}
          className={zoom ? 'mx-auto block w-[200%] max-w-none cursor-zoom-out' : 'fade mx-auto block max-h-full max-w-full cursor-zoom-in object-contain'} />
      </div>
      {photo.caption && <p className="px-4 py-3 text-center text-xs opacity-80">{photo.caption}</p>}
    </div>
  )
}
