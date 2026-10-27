import { useState } from 'react'
import Icon from './Icons'
import { useEscape, useScrollLock } from './layers'
import { supabase } from './supabase'
import { changePassword } from './authApi'

export default function ChangePassword({ onClose }) {
  useEscape(onClose)
  useScrollLock()
  const [cur, setCur] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (pw.length < 6) return setMsg({ type: 'err', text: 'Password must be at least 6 characters.' })
    if (pw !== pw2) return setMsg({ type: 'err', text: 'The two passwords do not match.' })
    setBusy(true); setMsg({ type: '', text: '' })
    try {
      const { data } = await supabase.auth.getSession()
      await changePassword(cur, pw, data?.session?.access_token)
    } catch (err) {
      setBusy(false)
      return setMsg({ type: 'err', text: err.message })
    }
    setBusy(false)
    setMsg({ type: 'ok', text: 'Password updated.' })
    setTimeout(onClose, 1200)
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Change password" className="fade fixed inset-0 z-[45] grid place-items-center p-4" style={{ background: '#0b120f80', backdropFilter: 'blur(3px)' }}
      onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <form onSubmit={submit} className="sheet w-full max-w-sm rounded-3xl p-5 shadow-2xl" style={{ background: 'var(--surface)' }}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Change password</h2>
          <button type="button" onClick={onClose} className="ghost grid h-8 w-8 place-items-center rounded-full" style={{ color: 'var(--mute)' }} aria-label="Close"><Icon name="x" size={18} /></button>
        </div>
        <input type="password" autoFocus required autoComplete="current-password" placeholder="Current password" value={cur} onChange={e => setCur(e.target.value)} className="input mb-3" />
        <input type="password" required placeholder="New password" value={pw} onChange={e => setPw(e.target.value)} className="input mb-3" />
        <input type="password" required placeholder="Confirm new password" value={pw2} onChange={e => setPw2(e.target.value)} className="input mb-4" />
        {msg.text && (
          <p className="fade mb-3 rounded-lg px-3 py-2 text-sm"
            style={msg.type === 'ok' ? { background: 'var(--okbg)', color: 'var(--ok)' } : { background: 'var(--errbg)', color: 'var(--bad)' }}>{msg.text}</p>
        )}
        <button disabled={busy} className="btn btn-pri w-full">{busy ? 'Updating…' : 'Update password'}</button>
      </form>
    </div>
  )
}
