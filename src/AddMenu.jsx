import { useEffect, useRef } from 'react'
import Icon from './Icons'
import { canTakePhoto } from './capture'

// What the + button offers: scan a bill (camera on phones), upload a bill photo, or add by hand.
// The bill choices are real file inputs, so the photo is picked in the same tap (phones refuse to
// open the camera from code that runs later) and handed over with onPick({ file }).
export default function AddMenu({ onPick, onClose }) {
  const ref = useRef(null)
  const phone = canTakePhoto(window)

  useEffect(() => {
    const key = e => { if (e.key === 'Escape') onClose() }
    const out = e => { if (!ref.current?.contains(e.target) && !e.target.closest?.('[data-addbtn]')) onClose() }
    document.addEventListener('keydown', key)
    document.addEventListener('mousedown', out)
    return () => { document.removeEventListener('keydown', key); document.removeEventListener('mousedown', out) }
  }, [onClose])

  const file = e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onPick({ file: f }) }
  const row = (icon, bg, fg, title, sub) => (
    <>
      <span className="qicon" style={{ background: bg, color: fg }}><Icon name={icon} size={20} /></span>
      <span className="min-w-0">
        <span className="block font-semibold">{title}</span>
        <span className="block text-[13px]" style={{ color: 'var(--mute)' }}>{sub}</span>
      </span>
    </>
  )

  return (
    <>
      <div className="scrim mobile-only" onMouseDown={onClose} />
      <div ref={ref} className="actsheet" role="menu" aria-label="Add">
        {phone && (
          <label className="actrow" role="menuitem">
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={file} data-testid="add-camera" />
            {row('camera', 'var(--accent-soft)', 'var(--accent-ink)', 'Scan a bill', 'Take a photo — dishes and prices fill in')}
          </label>
        )}
        <label className="actrow" role="menuitem">
          <input type="file" accept="image/*" className="hidden" onChange={file} data-testid="add-upload" />
          {row('upload', 'var(--accent-soft)', 'var(--accent-ink)', phone ? 'Upload bill photo' : 'Scan a bill photo', 'From your gallery or files')}
        </label>
        <button type="button" className="actrow" role="menuitem" onClick={() => onPick({})}>
          {row('pencil', 'var(--pri-soft)', 'var(--pri)', 'Add manually', 'Type in the place and dishes')}
        </button>
      </div>
    </>
  )
}
