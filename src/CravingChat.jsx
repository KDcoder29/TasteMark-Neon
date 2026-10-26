import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from './Icons'
import { Stars } from './shared'
import { expandQuery } from './foodLexicon'
import { docsFromPlaces, parseCraving, rankDishes, relatedSearches } from './smartSearch'
import { embed } from './embedder'
import { smartIndex } from './smartIndex'

const STARTERS = ['South Indian', 'Something cold', 'Spicy snack under ₹100', 'Dessert', 'Healthy breakfast', 'Good coffee']

// "Craving?" — ask in your own words; an on-device AI model + a food dictionary find matching
// dishes in YOUR journal, even ones you never labelled that way. Tap a result to open the place.
export default function CravingChat({ places, onOpenPlace, onClose }) {
  const docs = useMemo(() => docsFromPlaces(places), [places])
  const [ml, setMl] = useState(() => smartIndex.get())   // idle | loading (+ step, pct) | ready | off
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef(null)
  const mute = { color: 'var(--mute)' }

  // the AI is normally already prepared in the background after login (see Journal);
  // ensure() is a no-op then, and starts it here only if it hasn't run (e.g. Data Saver on)
  useEffect(() => {
    const off = smartIndex.subscribe(() => setMl(smartIndex.get()))
    smartIndex.ensure(docs)
    setMl(smartIndex.get())
    return off
  }, [docs])

  useEffect(() => {
    const key = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [onClose])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages])

  async function send(text) {
    const asked = (text ?? input).trim()
    if (!asked || busy) return
    setInput(''); setBusy(true)
    const { query, priceLimit } = parseCraving(asked)
    const { vecs } = smartIndex.get()
    let qvec = null
    if (vecs && query) { try { [qvec] = await embed([query]) } catch (e) { console.error(e) } }
    const results = rankDishes({ query: query || asked, docs, qvec, vecs, priceLimit })
    const answer = { results, related: relatedSearches(results, query || asked), topics: expandQuery(query).topics, priceLimit, smart: !!qvec }
    setMessages(m => [...m, { role: 'user', text: asked }, { role: 'bot', answer }])
    setBusy(false)
  }

  const status = ml.state === 'ready' ? 'Smart matching on · runs on this device'
    : ml.state === 'off' ? 'Word matching only (the AI model could not load)'
    : ml.step === 'index' ? `Reading your journal… ${ml.pct ?? 0}%`
    : `Getting smart… one-time download${ml.pct ? ` ${ml.pct}%` : ''}`

  return (
    <>
      <div className="scrim" onMouseDown={onClose} />
      <section className="drawer lg:!w-[480px]" role="dialog" aria-modal="true" aria-label="Craving something?">
        <div className="grabber" />
        <div className="flex items-start justify-between gap-3 border-b px-5 pb-3 pt-2 lg:pt-6" style={{ borderColor: 'var(--line)' }}>
          <div className="min-w-0">
            <h2 className="m-0 text-xl font-extrabold">Craving something?</h2>
            <p className="m-0 mt-0.5 flex items-center gap-1.5 text-xs" style={mute} aria-live="polite">
              <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: ml.state === 'ready' ? 'var(--ok)' : ml.state === 'off' ? 'var(--faint)' : 'var(--accent)' }} />
              {status}
            </p>
            {ml.state === 'loading' && <div className="scanbar mt-2 w-48" aria-hidden="true" />}
          </div>
          <button onClick={onClose} aria-label="Close" className="ghost grid h-9 w-9 shrink-0 place-items-center rounded-full" style={mute}><Icon name="x" size={18} /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4" style={{ minHeight: 280 }}>
          {messages.length === 0 && (
            <div className="fade px-1">
              <p className="m-0 text-[15px]">Tell me what you feel like, in your own words. I'll look through <b>your</b> {docs.length} dishes — even ones you never labelled that way.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {STARTERS.map(s => <button key={s} className="chip" onClick={() => send(s)}>{s}</button>)}
              </div>
            </div>
          )}
          {messages.map((m, i) => m.role === 'user' ? (
            <div key={i} className="rise flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-md px-3.5 py-2 text-[15px]" style={{ background: 'var(--pri)', color: 'var(--on-pri)' }}>{m.text}</div>
            </div>
          ) : (
            <Answer key={i} a={m.answer} onOpen={id => onOpenPlace(id)} onAsk={send} />
          ))}
          {busy && <div className="scanbar w-24" aria-label="Searching" />}
          <div ref={endRef} />
        </div>

        <form onSubmit={e => { e.preventDefault(); send() }} className="flex items-center gap-2 border-t px-4 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-3" style={{ borderColor: 'var(--line)' }}>
          <input autoFocus value={input} onChange={e => setInput(e.target.value)} placeholder="e.g. south indian under ₹150" aria-label="What are you craving?" className="input" />
          <button type="submit" disabled={!input.trim() || busy} className="btn btn-pri shrink-0 !px-4" aria-label="Ask">Ask</button>
        </form>
      </section>
    </>
  )
}

function Answer({ a, onOpen, onAsk }) {
  const mute = { color: 'var(--mute)' }
  const n = a.results.length
  const what = a.topics.length ? ` for ${a.topics.slice(0, 2).join(' / ')}` : ''
  return (
    <div className="rise space-y-2.5">
      <p className="m-0 text-[15px]">
        {n ? <>Found <b>{n} pick{n === 1 ? '' : 's'}{what}</b> in your journal{a.priceLimit ? ` under ₹${a.priceLimit}` : ''}.</>
          : <>Nothing in your journal matches that yet{a.priceLimit ? ` under ₹${a.priceLimit}` : ''}.</>}
        {!a.smart && n > 0 && <span className="block text-xs" style={mute}>Quick matches — smart matching is still warming up.</span>}
      </p>
      {a.results.map(({ doc, why }) => (
        <button key={doc.dish.id || doc.key} onClick={() => onOpen(doc.place.id)} className="pcard !items-center !gap-3 !p-3 !rounded-2xl">
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate font-bold">{doc.dish.name}</span>
              {doc.dish.order_again === 'yes' && <span className="pill pill-ok shrink-0">Order again</span>}
            </span>
            <span className="block truncate text-[13px]" style={mute}>{doc.place.name}{doc.place.city ? ` · ${doc.place.city}` : ''}</span>
            <span className="mt-0.5 block text-[11.5px] font-semibold" style={{ color: 'var(--accent-ink)' }}>
              {why === 'meaning' ? 'Similar in meaning' : why === 'family' ? 'Same food family' : 'Matches your words'}
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block font-bold">{doc.dish.price ? `₹${doc.dish.price}` : '–'}</span>
            <Stars n={Math.round(doc.dish.rating || 0)} />
          </span>
          <Icon name="chevron" size={16} style={mute} />
        </button>
      ))}
      {a.related.length > 0 && (
        <div className="pt-1">
          <p className="m-0 mb-1.5 text-xs font-bold" style={mute}>RELATED</p>
          <div className="flex flex-wrap gap-2">
            {a.related.map(r => <button key={r} className="chip" onClick={() => onAsk(r)}><Icon name="search" size={13} /> {r}</button>)}
          </div>
        </div>
      )}
    </div>
  )
}
