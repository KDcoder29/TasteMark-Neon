import { useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icons'
import { useEscape, useScrollLock } from './layers'

// The screen recording of the app (made with sample data, no one's real journal). The MP4 (H.264,
// plays on every phone) and its poster live in public/demo/; e2e/demo/record-demo.js re-records it.
export default function DemoVideo({ onClose }) {
  const [failed, setFailed] = useState(false)
  useEscape(onClose)
  useScrollLock()

  return createPortal(
    <div className="fade fixed inset-0 z-[60] grid place-items-center p-4" style={{ background: '#0b120fe6' }}
      onMouseDown={e => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true" aria-label="BiteMark in action">
      <div className="sheet relative w-full max-w-[400px]">
        <button onClick={onClose} aria-label="Close" className="absolute -top-12 right-0 grid h-10 w-10 place-items-center rounded-full" style={{ background: '#ffffff1f', color: '#fff' }}>
          <Icon name="x" size={20} />
        </button>
        {failed ? (
          <div className="rounded-2xl p-6 text-center" style={{ background: 'var(--surface)' }}>
            <p className="m-0 font-semibold">The video couldn’t play here.</p>
            <p className="mb-0 mt-1 text-sm" style={{ color: 'var(--mute)' }}>Check your connection, or play the tour instead. It shows the same features.</p>
          </div>
        ) : (
          <video controls autoPlay playsInline muted poster="/demo/poster.jpg" onError={() => setFailed(true)}
            className="mx-auto block max-h-[82vh] max-w-full rounded-2xl bg-black" style={{ aspectRatio: '430 / 932' }}>
            <source src="/demo/bitemark-demo.mp4" type="video/mp4" onError={() => setFailed(true)} />
          </video>
        )}
      </div>
    </div>,
    document.body,
  )
}
