import { useRef, useState } from 'react'
import { readBillText } from './billOcr'
import { parseBillText } from './billParse'

// "Scan a bill" tile in the Add place form. Reads the photo on this device (free) and hands back
// [{ name, price }] for every dish line it finds. Stars and comments are left for you to add.
export default function BillScan({ onDishes }) {
  const input = useRef(null)
  const [state, setState] = useState({ step: 'idle' })   // idle | reading | done | empty | error
  const reading = state.step === 'reading'

  async function scan(e) {
    const file = e.target.files?.[0]
    e.target.value = ''                                     // lets you pick the same photo again
    if (!file) return
    setState({ step: 'reading', progress: 0 })
    try {
      const text = await readBillText(file, p => setState({ step: 'reading', progress: p }))
      const found = parseBillText(text)
      if (!found.length) return setState({ step: 'empty' })
      onDishes(found)
      setState({ step: 'done', count: found.length })
    } catch (err) {
      console.error(err)
      setState({ step: 'error' })
    }
  }

  const pct = Math.round((state.progress || 0) * 100)
  const mute = { color: 'var(--mute)' }

  return (
    <div className="mb-3">
      <input ref={input} type="file" accept="image/*" onChange={scan} className="hidden" aria-label="Bill photo" data-testid="bill-input" />
      <button type="button" disabled={reading} onClick={() => input.current?.click()}
        className="flex w-full items-center gap-3 rounded-2xl border-2 border-dashed px-4 py-3 text-left transition hover:border-[var(--pri)] disabled:cursor-wait"
        style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: 'var(--soft)', color: 'var(--pri)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{reading ? `Reading bill… ${pct}%` : 'Scan a bill'}</span>
          {reading ? (
            <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--line)' }}>
              <span className="block h-full rounded-full transition-[width] duration-300" style={{ width: `${Math.max(pct, 4)}%`, background: 'var(--pri)' }} />
            </span>
          ) : (
            <span className="block text-xs" style={mute}>Fills in dish names and prices. You add stars and a comment.</span>
          )}
        </span>
      </button>

      <div aria-live="polite">
        {state.step === 'done' && (
          <p className="fade mt-2 rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--okbg)', color: 'var(--ok)' }}>
            Added {state.count} {state.count === 1 ? 'dish' : 'dishes'} from the bill. Check each name and price, then add stars and a comment.
          </p>
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
    </div>
  )
}
