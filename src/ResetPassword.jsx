import { useState } from 'react'
import Logo from './Logo'
import { resetPassword } from './authApi'

// Opened from the link in the reset email: /reset-password?token=...
export default function ResetPassword() {
  const token = new URLSearchParams(window.location.search).get('token')
  const linkError = new URLSearchParams(window.location.search).get('error')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  const goLogin = () => window.location.replace('/')

  async function submit(e) {
    e.preventDefault()
    if (pw.length < 6) return setError('Password must be at least 6 characters.')
    if (pw !== pw2) return setError('The two passwords do not match.')
    setBusy(true); setError('')
    try { await resetPassword(token, pw); setDone(true) }
    catch (err) { setError(err.message) }
    setBusy(false)
  }

  const bad = !token || linkError
  return (
    <div className="grid min-h-screen place-items-center p-4">
      <div className="card login-card rise w-full max-w-sm !p-6 sm:!p-7">
        <div className="mb-5 flex items-center gap-2.5"><Logo size={36} /><span className="text-lg font-bold">BiteMark</span></div>
        {done ? (
          <>
            <h2 className="text-2xl font-bold">Password updated</h2>
            <p className="mb-5 mt-2 text-sm" style={{ color: 'var(--mute)' }}>You can now log in with your new password.</p>
            <button onClick={goLogin} className="btn btn-pri w-full">Go to login</button>
          </>
        ) : bad ? (
          <>
            <h2 className="text-2xl font-bold">Link not valid</h2>
            <p className="mb-5 mt-2 text-sm" style={{ color: 'var(--mute)' }}>This reset link is invalid or has expired. Request a new one from the login page.</p>
            <button onClick={goLogin} className="btn btn-pri w-full">Back to login</button>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <h2 className="text-2xl font-bold">Choose a new password</h2>
            <p className="mb-2 mt-1 text-sm" style={{ color: 'var(--mute)' }}>At least 6 characters.</p>
            <div className="relative">
              <input type={show ? 'text' : 'password'} required minLength={6} autoComplete="new-password" autoFocus
                placeholder="New password" value={pw} onChange={e => setPw(e.target.value)} className="input !pr-16" />
              <button type="button" onClick={() => setShow(!show)} className="tbtn absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold"
                style={{ color: 'var(--pri)' }}>{show ? 'Hide' : 'Show'}</button>
            </div>
            <input type={show ? 'text' : 'password'} required minLength={6} autoComplete="new-password"
              placeholder="Confirm new password" value={pw2} onChange={e => setPw2(e.target.value)} className="input" />
            {error && <p className="fade rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--errbg)', color: 'var(--bad)' }}>{error}</p>}
            <button disabled={busy} className="btn btn-pri w-full !mt-5">{busy ? 'Please wait…' : 'Update password'}</button>
          </form>
        )}
      </div>
    </div>
  )
}
