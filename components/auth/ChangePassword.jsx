import { useState } from 'react'
import Icon from '@/components/ui/Icons'
import { useEscape, useScrollLock } from '@/hooks/layers'
import { supabase } from '@/lib/supabase'
import { changePassword } from '@/lib/authApi'
import { useUnsaved, guardClose } from '@/hooks/unsaved'

export default function ChangePassword({ onClose }) {
  const close = guardClose('password', onClose)   // asks first when something was typed
  useEscape(close)
  useScrollLock()
  const [cur, setCur] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [msg, setMsg] = useState({ type: '', text: '' })
  // half-filled fields count; once it says "Password updated." there is nothing left to lose
  useUnsaved({ scope: 'password', changed: !!(cur || pw || pw2) && msg.type !== 'ok', what: 'the password fields', save: () => submit(), close: onClose })
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e?.preventDefault()
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
    return true
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Change password" className="fade fixed inset-0 z-[45] grid place-items-center p-4" style={{ background: '#0b120f80', backdropFilter: 'blur(3px)' }}
      onMouseDown={e => e.target === e.currentTarget && close()}>
      <form onSubmit={submit} className="sheet w-full max-w-sm rounded-3xl p-5 shadow-2xl" style={{ background: 'var(--surface)' }}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Change password</h2>
          <button type="button" onClick={close} className="ghost grid h-8 w-8 place-items-center rounded-full" style={{ color: 'var(--mute)' }} aria-label="Close"><Icon name="x" size={18} /></button>
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
