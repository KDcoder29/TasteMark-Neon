import { useEffect, useState } from 'react'
import Icon from './Icons'
import { findOnGoogleUrl, pasteMapsLink } from './locationSupport'

const PASTE_HELP = {
  blocked: 'Your browser didn’t allow pasting. Long-press the box below and paste the link there.',
  empty: 'Nothing copied yet. In Google Maps tap Share, then Copy link.',
  'not-maps': 'What you copied isn’t a Google Maps link. In Google Maps tap Share, then Copy link.',
}

// "Find on Google Maps" -> (Share -> Copy link in Google Maps) -> "Paste link".
// Google finds the place from its name, area and city; the exact position comes from the copied link.
// onLink(link) gets the pasted Google Maps link.
export default function GoogleLocate({ place, onLink, onBlocked, busy = false, big = false }) {
  const url = findOnGoogleUrl(place)
  const [opened, setOpened] = useState(false)
  const [back, setBack] = useState(false)          // came back from Google Maps: the next step is Paste
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!opened) return
    const onShow = () => { if (document.visibilityState === 'visible') setBack(true) }
    document.addEventListener('visibilitychange', onShow)
    window.addEventListener('focus', onShow)
    return () => { document.removeEventListener('visibilitychange', onShow); window.removeEventListener('focus', onShow) }
  }, [opened])

  async function paste() {
    setMsg('')
    const r = await pasteMapsLink(navigator.clipboard)
    if (r.link) { setBack(false); onLink(r.link) }
    else { setMsg(PASTE_HELP[r.error]); if (r.error === 'blocked') onBlocked?.() }
  }

  const size = big ? '' : '!px-3 !text-sm'
  return (
    <div className="glocate">
      <div className="flex gap-2">
        {url
          ? <a className={`btn ${opened ? '' : 'btn-pri'} flex-[3] whitespace-nowrap ${size}`} href={url} target="_blank" rel="noopener noreferrer" onClick={() => { setOpened(true); setMsg('') }}>
              <Icon name="map" size={17} /> {opened ? 'Open Maps again' : 'Find on Google Maps'}
            </a>
          : <span className={`btn flex-[3] ${size}`} aria-disabled="true" style={{ opacity: .55 }}><Icon name="map" size={17} /> Type the name first</span>}
        <button type="button" className={`btn ${opened ? 'btn-pri' : ''} ${back ? 'glocate-ready' : ''} flex-[2] whitespace-nowrap ${size}`} onClick={paste} disabled={busy}>
          <Icon name="copy" size={17} /> {busy ? 'Reading…' : 'Paste link'}
        </button>
      </div>
      <p className="m-0 mt-1.5 text-xs" role="status" style={{ color: msg ? 'var(--bad)' : 'var(--mute)' }}>
        {msg || (opened ? 'Is it the right place? Tap Share, then Copy link. Come back and tap Paste link.'
          : 'Google Maps searches the name, area and city. Then Share → Copy link, and paste it here.')}
      </p>
    </div>
  )
}
