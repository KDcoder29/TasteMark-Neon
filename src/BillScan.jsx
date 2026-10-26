import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { readBillText } from './billOcr'
import { parseBillText } from './billParse'
import { canTakePhoto } from './capture'

// "Scan a bill" tile in the Add place form. Take a photo of the bill (phones) or upload one; it is
// read on this device (free) and every dish line found is handed to onDishes([{ name, price }]),
// which returns how many were actually added. Stars and comments are left for you to add.
// The photo stays on the device: it is only shown as a thumbnail to check against while reviewing.
export default function BillScan({ onDishes }) {
  const camera = useRef(null)
  const upload = useRef(null)
  const [state, setState] = useState({ step: 'idle' })   // idle | reading | done | empty | error
  const [photo, setPhoto] = useState(null)                // object URL of the last bill photo
  const [viewing, setViewing] = useState(false)
  const [phone] = useState(() => canTakePhoto(typeof window === 'undefined' ? undefined : window))
  const reading = state.step === 'reading'
  // reading takes a few seconds; use the form's latest handler so rows typed meanwhile survive
  const latest = useRef(onDishes)
  latest.current = onDishes

  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo) }, [photo])

  async function scan(e) {
    const file = e.target.files?.[0]
    e.target.value = ''                                     // lets you pick the same photo again
    if (!file) return
    setPhoto(URL.createObjectURL(file))
    setState({ step: 'reading', progress: 0 })
    try {
      const text = await readBillText(file, p => setState({ step: 'reading', progress: p }))
      const found = parseBillText(text)
      if (!found.length) return setState({ step: 'empty' })
      setState({ step: 'done', count: latest.current(found), found: found.length })
    } catch (err) {
      console.error(err)
      setState({ step: 'error' })
    }
  }

  const pct = Math.round((state.progress || 0) * 100)
  const mute = { color: 'var(--mute)' }
  const scanned = state.step === 'done'
  const pick = 'chip !py-1.5 inline-flex items-center gap-1.5 font-semibold'

  return (
    <div className="mb-3">
      <input ref={camera} type="file" accept="image/*" capture="environment" onChange={scan} className="hidden" aria-label="Take a photo of the bill" data-testid="bill-camera" />
      <input ref={upload} type="file" accept="image/*" onChange={scan} className="hidden" aria-label="Upload a bill photo" data-testid="bill-input" />

      <div className="rounded-2xl border-2 border-dashed px-4 py-3" style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}>
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: 'var(--soft)', color: 'var(--pri)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6M9 16h3" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">
              {reading ? `Reading bill… ${pct}%` : scanned ? 'Add more from the bill' : 'Scan a bill'}
            </div>
            {reading ? (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--line)' }}>
                <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${Math.max(pct, 4)}%`, background: 'var(--pri)' }} />
              </div>
            ) : (
              <>
                <p className="text-xs" style={mute}>
                  {scanned ? 'Long bill? Photograph the next part. Dishes already in the list are skipped.'
                    : 'Fills in dish names and prices. You add stars and a comment.'}
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {phone && (
                    <button type="button" onClick={() => camera.current?.click()} className={`${pick} on`}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" />
                      </svg>
                      Take photo
                    </button>
                  )}
                  <button type="button" onClick={() => upload.current?.click()} className={`${pick} ${phone ? '' : 'on'}`}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v4h16v-4" />
                    </svg>
                    {phone ? 'Upload' : 'Upload bill photo'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div aria-live="polite">
        {scanned && (
          <div className="fade mt-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--okbg)', color: 'var(--ok)' }}>
            {photo && (
              <button type="button" onClick={() => setViewing(true)} aria-label="View the bill photo"
                className="relative h-12 w-10 shrink-0 overflow-hidden rounded-md border transition active:scale-95" style={{ borderColor: 'var(--ok)' }}>
                <img src={photo} alt="" className="h-full w-full object-cover" />
              </button>
            )}
            <p>
              {state.count
                ? <>Added {state.count} {state.count === 1 ? 'dish' : 'dishes'} from the bill. Check each name and price, then add stars and a comment.</>
                : <>Those {state.found === 1 ? 'dish is' : 'dishes are'} already in the list.</>}
              {photo && <> <button type="button" onClick={() => setViewing(true)} className="font-semibold underline">View bill</button></>}
            </p>
          </div>
        )}
        {state.step === 'empty' && (
          <p className="fade mt-2 rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--errbg)', color: 'var(--bad)' }}>
            No dish lines found on that photo. Retake it flat, in good light, with the item list filling the frame.
          </p>
        )}
        {state.step === 'error' && (
          <p className="fade mt-2 rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--errbg)', color: 'var(--bad)' }}>
            Couldn't read the photo. Check your connection for the first scan, then try again.
          </p>
        )}
      </div>

      {viewing && photo && <BillViewer src={photo} onClose={() => setViewing(false)} />}
    </div>
  )
}

// Full-screen bill photo to check names and prices against. Scrolls/pinch-zooms; Esc or tap outside closes.
// Rendered into <body>: inside the form, the form's slide-in transform made `fixed` mean
// "form-sized" and drew the form's fields on top of the photo.
function BillViewer(props) {
  return createPortal(<BillViewerPanel {...props} />, document.body)
}

function BillViewerPanel({ src, onClose }) {
  const [zoom, setZoom] = useState(false)
  useEffect(() => {
    const esc = e => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    window.addEventListener('keydown', esc, true)
    return () => window.removeEventListener('keydown', esc, true)
  }, [onClose])

  return (
    <div role="dialog" aria-modal="true" aria-label="Bill photo" className="fade fixed inset-0 z-40 flex flex-col"
      style={{ background: '#0f172ae6' }} onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="flex items-center justify-between px-4 py-3 text-sm text-white">
        <button type="button" onClick={() => setZoom(!zoom)} className="rounded-full px-3 py-1.5 font-semibold" style={{ background: '#ffffff1f' }}>
          {zoom ? 'Fit to screen' : 'Zoom in'}
        </button>
        <button type="button" onClick={onClose} aria-label="Close bill photo" autoFocus
          className="grid h-9 w-9 place-items-center rounded-full text-xl" style={{ background: '#ffffff1f' }}>×</button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-3 pb-6" onMouseDown={e => e.target === e.currentTarget && onClose()}>
        <img src={src} alt="Bill" onClick={() => setZoom(!zoom)}
          className={zoom ? 'mx-auto block w-[200%] max-w-none cursor-zoom-out' : 'mx-auto block max-h-full max-w-full cursor-zoom-in object-contain'} />
      </div>
    </div>
  )
}
