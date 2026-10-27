import { useEffect, useState } from 'react'
import Icon from './Icons'
import Toast from './Toast'
import { useSheetDrag } from './useGestures'
import { pickShareDishes, shareCaption, shareFileName } from './shareCard'
import { drawShareCard } from './shareImage'

const pref = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v === '1' } catch { return d } }
const keep = (k, v) => { try { localStorage.setItem(k, v ? '1' : '0') } catch {} }

// "Send to friends": a preview of the picture first, so you see exactly what goes out.
// Phones: the share sheet (WhatsApp, Instagram…) with the picture + caption.
// Laptops: download the picture and copy the caption; or send just the text on WhatsApp.
export default function ShareSheet({ place, group, onClose }) {
  const drag = useSheetDrag(onClose)
  const [prices, setPrices] = useState(() => pref('share.prices', true))
  const [notes, setNotes] = useState(() => pref('share.notes', true))
  const [img, setImg] = useState(null)            // { url, blob }
  const [toast, setToast] = useState('')
  const { shown, more } = pickShareDishes(place)
  const caption = shareCaption(place, shown, { prices, notes })
  const file = img && new File([img.blob], shareFileName(place.name), { type: 'image/png' })
  const canSendFile = !!(file && navigator.canShare?.({ files: [file] }))

  useEffect(() => {
    let gone = false, url = null
    drawShareCard({ place, shown, more, prices, notes, group: group?.name })
      .then(blob => { if (gone || !blob) return; url = URL.createObjectURL(blob); setImg({ url, blob }) })
    return () => { gone = true; if (url) URL.revokeObjectURL(url) }
  }, [prices, notes])

  useEffect(() => {
    const key = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [onClose])

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2600); return () => clearTimeout(t) }, [toast])

  const copy = async () => { try { await navigator.clipboard.writeText(caption); return true } catch { return false } }

  async function share() {
    if (!file) return
    if (canSendFile) {
      try { await navigator.share({ files: [file], text: caption, title: place.name }) }
      catch (e) { if (e.name !== 'AbortError') setToast('Could not open sharing. Try "Send as text".') }
      return
    }
    const a = document.createElement('a')
    a.href = img.url; a.download = file.name; a.click()
    setToast((await copy()) ? 'Picture downloaded · caption copied' : 'Picture downloaded')
  }

  const toggle = (on, set, k) => { set(!on); keep(k, !on) }
  const mute = { color: 'var(--mute)' }

  return (
    <>
      <div className="scrim" onMouseDown={onClose} />
      <section ref={drag} className="drawer lg:!w-[460px]" role="dialog" aria-modal="true" aria-label="Send to friends">
        <div className="grabber" />
        <div className="flex items-center justify-between px-5 pb-2 pt-2 lg:pt-6">
          <h2 className="m-0 text-lg font-bold">Send to friends</h2>
          <button onClick={onClose} aria-label="Close" className="ghost grid h-9 w-9 place-items-center rounded-full" style={mute}><Icon name="x" size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-3">
          <div className="sharepreview">
            {img ? <img src={img.url} alt={`Picture of ${place.name} to share`} className="fade" /> : <div className="skel !rounded-none" />}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold" style={mute}>Show</span>
            <button className={`chip ${prices ? 'on' : ''}`} aria-pressed={prices} onClick={() => toggle(prices, setPrices, 'share.prices')}>
              {prices && <Icon name="check" size={14} stroke={2.8} />} Prices
            </button>
            <button className={`chip ${notes ? 'on' : ''}`} aria-pressed={notes} onClick={() => toggle(notes, setNotes, 'share.notes')}>
              {notes && <Icon name="check" size={14} stroke={2.8} />} My comments
            </button>
          </div>
        </div>

        <div className="grid gap-2 border-t px-5 pb-6 pt-3" style={{ borderColor: 'var(--line)' }}>
          <button className="btn btn-pri w-full" disabled={!img} onClick={share}>
            <Icon name={canSendFile ? 'send' : 'download'} size={18} /> {canSendFile ? 'Share picture' : 'Download picture'}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <a className="btn !text-sm" href={`https://wa.me/?text=${encodeURIComponent(caption)}`} target="_blank" rel="noopener noreferrer">
              <Icon name="chat" size={17} /> Send as text
            </a>
            <button className="btn !text-sm" onClick={async () => setToast((await copy()) ? 'Text copied' : 'Could not copy')}>
              <Icon name="copy" size={17} /> Copy text
            </button>
          </div>
        </div>
      </section>
      {toast && <Toast text={toast} />}
    </>
  )
}
