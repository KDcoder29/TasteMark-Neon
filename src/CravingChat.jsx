import { useEffect, useRef, useState } from 'react'
import { Stars } from './shared'
import { cravingAnswer } from './craving'

const STARTERS = ['protein bar', 'something spicy', 'dessert', 'chips', 'under ₹100', 'dosa']

function ResultCard({ hit }) {
  const { place, dish } = hit
  return (
    <div className="rounded-xl border p-2.5 text-sm" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-semibold">{dish.name}</div>
          <div className="truncate text-xs" style={{ color: 'var(--mute)' }}>
            {place.name}{place.area || place.city ? ' · ' + [place.area, place.city].filter(Boolean).join(', ') : ''}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <Stars n={Math.round(dish.rating || 0)} />
          {dish.price != null && <div className="text-xs" style={{ color: 'var(--mute)' }}>₹{dish.price}</div>}
        </div>
      </div>
      {dish.order_again === 'yes' && <span className="pill pill-ok mt-1.5 inline-block !text-[11px]">Would order again</span>}
      {dish.note && <p className="mt-1.5 text-xs" style={{ color: 'var(--mute)' }}>{dish.note}</p>}
    </div>
  )
}

function BotReply({ answer }) {
  const { priceLimit, groups } = answer
  const any = groups.some(g => g.hits.length)
  return (
    <div className="space-y-3">
      {!any && (
        <p>
          You haven't logged anything matching that{priceLimit != null ? ` under ₹${priceLimit}` : ''} yet.
          Try a different word, or add it to your journal once you've tried it.
        </p>
      )}
      {groups.map(g => (
        <div key={g.term}>
          {groups.length > 1 && (
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--mute)' }}>
              {g.hits.length ? `For "${g.term}"` : `Nothing for "${g.term}" yet`}
            </p>
          )}
          {g.hits.length > 0 && <div className="space-y-2">{g.hits.map(h => <ResultCard key={h.place.id + h.dish.id} hit={h} />)}</div>}
        </div>
      ))}
    </div>
  )
}

export default function CravingChat({ places, onClose }) {
  const [messages, setMessages] = useState([
    { role: 'bot', text: "Tell me what you're craving and I'll check what you've already tried — e.g. \"protein chips / bar\" or \"something spicy under 100\"." },
  ])
  const [input, setInput] = useState('')
  const endRef = useRef(null)
  const mute = { color: 'var(--mute)' }

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  function send(text) {
    const q = (text ?? input).trim()
    if (!q) return
    const answer = cravingAnswer(q, places)
    setMessages(m => [...m, { role: 'user', text: q }, { role: 'bot', answer }])
    setInput('')
  }

  return (
    <div className="fade fixed inset-0 z-[45] grid place-items-end sm:place-items-center overflow-y-auto p-0 sm:p-4"
      style={{ background: '#0b120f80', backdropFilter: 'blur(3px)' }}
      onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="sheet flex w-full max-w-sm flex-col rounded-t-3xl sm:rounded-3xl shadow-2xl"
        style={{ background: 'var(--surface)', height: 'min(640px, 88vh)' }}>
        <div className="flex items-center justify-between border-b px-5 py-3.5" style={{ borderColor: 'var(--line)' }}>
          <div>
            <h2 className="text-lg font-bold">🍽️ What should I eat?</h2>
            <p className="text-xs" style={mute}>Searches only the dishes you've already logged</p>
          </div>
          <button onClick={onClose} className="ghost grid h-8 w-8 shrink-0 place-items-center rounded-full text-xl" style={mute}>×</button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.map((m, i) => m.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-sm px-3.5 py-2 text-sm text-white" style={{ background: 'var(--pri)' }}>{m.text}</div>
            </div>
          ) : (
            <div key={i} className="flex justify-start">
              <div className="max-w-[88%] rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm" style={{ background: 'var(--dish)' }}>
                {m.answer ? <BotReply answer={m.answer} /> : m.text}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {messages.length <= 1 && (
          <div className="flex flex-wrap gap-1.5 px-4 pb-1">
            {STARTERS.map(s => <button key={s} className="chip !py-1 !text-xs" onClick={() => send(s)}>{s}</button>)}
          </div>
        )}

        <form onSubmit={e => { e.preventDefault(); send() }} className="flex items-center gap-2 border-t p-3" style={{ borderColor: 'var(--line)' }}>
          <input autoFocus value={input} onChange={e => setInput(e.target.value)} placeholder="I want something…" className="input !py-2.5" />
          <button type="submit" disabled={!input.trim()} className="btn btn-pri shrink-0 !px-4">Ask</button>
        </form>
      </div>
    </div>
  )
}
