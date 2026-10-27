import { useEffect, useRef, useState } from 'react'
import Icon from './Icons'
import { listen, speechSupported } from './speech'
import { parseSpoken } from './voiceParse'

const EXAMPLE = '“Sankalp, masala dosa, 180 rupees, 5 stars, crispy”'

// "Say it": speak the place and dishes; they fill the form for you to check (nothing is saved here).
// auto = start listening as soon as it appears (chosen from the + menu).
export default function VoiceAdd({ auto = false, knownPlaces = [], onResult }) {
  const [state, setState] = useState(auto ? 'listening' : 'idle')   // idle | listening | done | error
  const [heard, setHeard] = useState({ pieces: [], live: '' })
  const [msg, setMsg] = useState('')
  const [got, setGot] = useState(null)                               // { place, dishes } from the last go
  const rec = useRef(null)
  const latest = useRef(onResult)
  latest.current = onResult
  const mute = { color: 'var(--mute)' }

  function start() {
    setHeard({ pieces: [], live: '' }); setMsg(''); setState('listening')
    rec.current = listen({
      onUpdate: (pieces, live) => setHeard({ pieces, live }),
      onError: m => { setMsg(m); setState('error') },
      onEnd: pieces => {
        rec.current = null
        const r = parseSpoken(pieces, knownPlaces)
        if (!r.place && !r.dishes.length) {          // keep a more specific error (e.g. mic blocked)
          setMsg(m => m || `Didn't catch a dish. Try again, for example: ${EXAMPLE}`)
          setState('error')
          return
        }
        setGot(r); setState('done')
        latest.current(r)
      },
    })
  }

  // closing the form stops the microphone (development mode mounts twice: cancel, then start again)
  useEffect(() => {
    if (auto && speechSupported(window)) start()
    return () => { rec.current?.cancel(); rec.current = null }
  }, [])

  if (!speechSupported(window)) return null
  const listening = state === 'listening'

  return (
    <div className="mb-4" aria-live="polite">
      <div className={`voicebar ${listening ? 'on' : ''}`}>
        <button type="button" onClick={() => (listening ? rec.current?.stop() : start())}
          className={`micbtn ${listening ? 'on' : ''}`} aria-label={listening ? 'Done speaking' : 'Speak the place and dishes'}>
          <Icon name="mic" size={22} stroke={2.2} />
        </button>
        <div className="min-w-0 flex-1">
          {listening ? (
            <>
              <div className="text-sm font-semibold">Listening…</div>
              <p className="m-0 mt-0.5 text-[13.5px] leading-snug">
                {heard.pieces.length || heard.live
                  ? <>{heard.pieces.join(', ')}{heard.pieces.length && heard.live ? ', ' : ''}<span style={{ color: 'var(--faint)' }}>{heard.live}</span></>
                  : <span style={mute}>Place, dish, price, stars, comment. Say “next” for another dish.</span>}
              </p>
            </>
          ) : (
            <>
              <div className="text-sm font-semibold">{state === 'done' ? 'Say more' : 'Say it instead of typing'}</div>
              <p className="m-0 mt-0.5 text-xs" style={mute}>{state === 'done' ? 'Add another dish the same way.' : EXAMPLE}</p>
            </>
          )}
        </div>
        {listening && <button type="button" onClick={() => rec.current?.stop()} className="btn btn-pri !px-3.5 !py-1.5 !text-sm">Done</button>}
      </div>

      {state === 'done' && got && (
        <p className="fade m-0 mt-2 rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--okbg)', color: 'var(--ok)' }}>
          {got.place && <>Place: <b>{got.place}</b>. </>}
          {got.dishes.length
            ? <>Added {got.dishes.length} {got.dishes.length === 1 ? 'dish' : 'dishes'} from what you said. Check them, then Save.</>
            : <>Now say a dish, or type it below.</>}
        </p>
      )}
      {state === 'error' && msg && (
        <p className="fade m-0 mt-2 rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--errbg)', color: 'var(--bad)' }}>{msg}</p>
      )}
    </div>
  )
}
