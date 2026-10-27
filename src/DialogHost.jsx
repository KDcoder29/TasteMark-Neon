import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icons'
import { dialogs } from './dialogs'
import { useEscape, useScrollLock } from './layers'

// Draws the app's confirm / message boxes (see dialogs.js). Mounted once, next to App.
// The answer goes back AT ONCE (so e.g. a deleted place's form closes in the same instant);
// the box itself fades out on a leftover copy for 140 ms.
export default function DialogHost() {
  const [d, setD] = useState(dialogs.current())
  const [ghost, setGhost] = useState(null)          // the box that was just answered, fading out
  useEffect(() => dialogs.subscribe(setD), [])

  const close = (box, value) => {
    setGhost(box)
    dialogs.answer(value)
    setTimeout(() => setGhost(g => (g === box ? null : g)), 140)
  }
  if (!d && !ghost) return null
  return createPortal(
    <>
      {ghost && <Box key={'g' + ghost.id} d={ghost} leaving close={() => {}} />}
      {d && d !== ghost && <Box key={d.id} d={d} close={v => close(d, v)} />}
    </>,
    document.body,
  )
}

function Box({ d, leaving = false, close }) {
  useEscape(() => close(false))
  useScrollLock()
  const confirm = d.kind === 'confirm'
  const icon = d.danger ? 'trash' : d.tone === 'error' ? 'alert' : confirm ? 'help' : 'check'
  const tint = d.danger || d.tone === 'error'
    ? { background: 'var(--errbg)', color: 'var(--bad)' }
    : { background: 'var(--pri-soft)', color: 'var(--pri)' }

  return (
    <div className={`dlg-scrim ${leaving ? 'out' : ''}`} onMouseDown={e => e.target === e.currentTarget && close(false)}>
      <div className={`dlg ${leaving ? 'out' : ''}`} role={confirm ? 'alertdialog' : 'dialog'} aria-modal="true"
        aria-labelledby={`dlg-t${d.id}`} aria-describedby={`dlg-m${d.id}`}>
        <span className={`dlg-icon ${d.danger ? 'danger' : ''}`} style={tint}><Icon name={icon} size={22} stroke={2.2} /></span>
        <h2 id={`dlg-t${d.id}`} className="m-0 mt-3 text-[17px] font-bold leading-snug">{d.title || (confirm ? 'Are you sure?' : 'Something went wrong')}</h2>
        {d.message && <p id={`dlg-m${d.id}`} className="m-0 mt-1.5 text-[14.5px] leading-relaxed" style={{ color: 'var(--mute)' }}>{d.message}</p>}
        <div className={`mt-5 grid gap-2 ${confirm ? 'grid-cols-2' : ''}`}>
          {confirm && (
            // for deletes the safe choice has the focus, so a stray Enter never deletes anything
            <button className="btn" autoFocus={d.danger && !leaving} onClick={() => close(false)}>{d.cancelLabel}</button>
          )}
          <button className={`btn ${d.danger ? 'btn-danger' : 'btn-pri'}`} autoFocus={!d.danger && !leaving} onClick={() => close(true)}>
            {confirm ? d.confirmLabel : 'OK'}
          </button>
        </div>
      </div>
    </div>
  )
}
