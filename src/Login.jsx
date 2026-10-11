import { useState } from 'react'
import { supabase } from './supabase'
import Logo from './Logo'

export default function Login({ onSession }) {
  const [identity, setIdentity] = useState('')   // login: username or email
  const [username, setUsername] = useState('')     // signup only
  const [email, setEmail] = useState('')           // signup only
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [isSignup, setIsSignup] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const [forgot, setForgot] = useState(false)

  const lookup = async (param, value) => {
    let r
    try { r = await fetch(`/api/auth-lookup?${param}=${encodeURIComponent(value)}`) }
    catch { throw new Error('Could not reach the server. Please try again.') }
    const type = r.headers.get('content-type') || ''
    if (!r.ok || !type.includes('json')) {
      throw new Error('The username service is not available right now. Please try again, or use your email.')
    }
    return r.json()
  }

  // make sure a session really exists, then tell the app (do not rely only on the auth-change event)
  async function finish(result) {
    let s = result?.session
    if (!s) s = (await supabase.auth.getSession()).data?.session
    if (!s) {
      console.error('Signed in but no session was returned', result)
      throw new Error('You were signed in, but the session was not saved. In the Neon Console (Auth), add this site address as a trusted domain, then try again.')
    }
    onSession?.(s)
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError(''); setInfo('')
    try {
      if (forgot) {
        let mail = identity.trim()
        if (!mail.includes('@')) {                  // username -> email
          const { email: found } = await lookup('username', mail)
          mail = found || ''
        }
        if (mail) {
          const { error: e1 } = await supabase.auth.resetPasswordForEmail(mail, { redirectTo: `${window.location.origin}/reset-password` })
          if (e1) throw e1
        }
        // same message whether or not the account exists, so nobody can probe for accounts
        setInfo('If an account matches, a password reset link is on its way. Check your inbox (and spam).')
      } else if (isSignup) {
        const uname = username.trim()
        if (!/^[A-Za-z0-9_.]{3,20}$/.test(uname)) throw new Error('Username must be 3-20 characters: letters, numbers, _ or .')
        const { available } = await lookup('available', uname)
        if (!available) throw new Error('That username is taken. Please choose another.')
        // the username is stored as the account "name"
        const { error: e1 } = await supabase.auth.signUp({
          email: email.trim(), password, options: { data: { name: uname } },
        })
        if (e1) throw e1
        // if email verification is switched off in Neon Auth, signing in works straight away
        const { data: d2, error: e2 } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (e2) setInfo('Account created! If email verification is on, check your inbox, then log in.')
        else await finish(d2)
      } else {
        let loginEmail = identity.trim()
        if (!loginEmail.includes('@')) {            // it is a username: find its email
          const { email: found } = await lookup('username', loginEmail)
          if (!found) throw new Error('Incorrect username/email or password.')
          loginEmail = found
        }
        const { data: d1, error: e1 } = await supabase.auth.signInWithPassword({ email: loginEmail, password })
        if (e1) throw new Error(/invalid|incorrect|credential/i.test(e1.message) ? 'Incorrect username/email or password.' : e1.message)
        await finish(d1)
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    }
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 overflow-y-auto overflow-x-hidden" style={{ background: 'var(--bg)' }}>
      <div className="flex min-h-full items-center justify-center px-4 py-4">
      <div className="w-full max-w-sm">
        <div className="rise mb-4 flex flex-col items-center text-center">
          <Logo size={48} />
          <h1 className="mt-2.5 text-2xl font-bold leading-none tracking-tight">BiteMark</h1>
          <p className="mt-1.5 text-sm" style={{ color: 'var(--mute)' }}>Remember every great bite.</p>
        </div>

        <div className="card login-card rise !p-5 sm:!p-6" style={{ animationDelay: '80ms', boxShadow: '0 1px 2px #0f172a0d, 0 12px 32px #0f172a14' }}>
          <h2 className="text-xl font-bold tracking-tight">{forgot ? 'Reset your password' : isSignup ? 'Create your account' : 'Welcome back'}</h2>
          <p className="mb-4 mt-0.5 text-sm" style={{ color: 'var(--mute)' }}>
            {forgot ? 'Enter your username or email and we will send you a reset link.' : isSignup ? 'Start your food journal in under a minute.' : 'Log in to open your journal.'}
          </p>
          <form onSubmit={submit} className="space-y-2.5">
            {forgot ? (
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--mute)' }}>Username or email</label>
                <input required autoFocus autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="Username or you@example.com"
                  value={identity} onChange={e => setIdentity(e.target.value)} className="input" />
              </div>
            ) : isSignup ? (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--mute)' }}>Username</label>
                  <input required autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="3-20 letters, numbers, _ or ."
                    value={username} onChange={e => setUsername(e.target.value.replace(/\s/g, ''))} className="input" maxLength={20} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--mute)' }}>Email</label>
                  <input type="email" required autoComplete="email" placeholder="you@example.com" value={email}
                    onChange={e => setEmail(e.target.value)} className="input" />
                </div>
              </>
            ) : (
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--mute)' }}>Username or email</label>
                <input required autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="Username or you@example.com"
                  value={identity} onChange={e => setIdentity(e.target.value)} className="input" />
              </div>
            )}
            {!forgot && <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--mute)' }}>Password</label>
              <div className="relative">
                <input type={show ? 'text' : 'password'} required minLength={6}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  placeholder={isSignup ? 'At least 6 characters' : 'Your password'} value={password}
                  onChange={e => setPassword(e.target.value)} className="input !pr-16" />
                <button type="button" onClick={() => setShow(!show)}
                  className="tbtn absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold" style={{ color: 'var(--pri)' }}>
                  {show ? 'Hide' : 'Show'}</button>
              </div>
              {!isSignup && <div className="mt-1.5 text-right"><button type="button" className="tbtn text-xs font-semibold" style={{ color: 'var(--pri)' }}
                onClick={() => { setForgot(true); setError(''); setInfo('') }}>Forgot password?</button></div>}
            </div>}
            {error && <p className="fade rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--errbg)', color: 'var(--bad)' }}>{error}</p>}
            {info && <p className="fade rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--okbg)', color: 'var(--ok)' }}>{info}</p>}
            <button disabled={busy} className="btn btn-pri w-full !mt-4">
              {busy ? 'Please wait…' : forgot ? 'Send reset link' : isSignup ? 'Create account' : 'Log in'}</button>
          </form>
          {forgot ? (
            <p className="mt-4 text-center text-sm">
              <button className="tbtn font-semibold" style={{ color: 'var(--pri)' }} onClick={() => { setForgot(false); setError(''); setInfo('') }}>Back to log in</button>
            </p>
          ) : <p className="mt-4 text-center text-sm" style={{ color: 'var(--mute)' }}>
            {isSignup ? 'Already have an account?' : 'New to BiteMark?'}{' '}
            <button onClick={() => { setIsSignup(!isSignup); setError(''); setInfo(''); setPassword('') }}
              className="tbtn font-semibold" style={{ color: 'var(--pri)' }}>{isSignup ? 'Log in' : 'Create an account'}</button>
          </p>}
        </div>
      </div>
      </div>
    </div>
  )
}
