'use client'
import { useState } from 'react'
import Logo from '@/components/ui/Logo'
import Icon from '@/components/ui/Icons'
import { useInstall } from '@/hooks/install'

// /install: the link you send to friends. One tap on Install where the browser allows it (Android
// Chrome, Edge, Samsung Internet, laptops); the steps for iPhone and for in-app browsers elsewhere.

// iOS / Safari "Share" (a box with an arrow) and the three-dots browser menu, drawn like the app's icons
const ShareGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v12M8 7l4-4 4 4" /><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
  </svg>
)
const DotsGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>
)
const Key = ({ children }) => <span className="inst-key">{children}</span>

function Steps({ items }) {
  return <ol className="inst-steps">{items.map((s, i) => <li key={i}>{s}</li>)}</ol>
}

export default function InstallPage() {
  const { mode, install } = useInstall()
  const [asking, setAsking] = useState(false)
  const [copied, setCopied] = useState(false)
  const mute = { color: 'var(--mute)' }

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.origin + '/install'); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch {}
  }

  const body = {
    installed: {
      title: 'BiteMark is on your home screen',
      text: 'Open it from there like any app, or right here.',
      action: <a href="/" className="btn btn-pri w-full !py-3 text-base">Open BiteMark</a>,
    },
    prompt: {
      title: 'Put BiteMark on your home screen',
      text: 'It opens like an app: full screen, one tap away. Free, no app store.',
      action: (
        <button className="btn btn-pri w-full !py-3 text-base" disabled={asking}
          onClick={async () => { setAsking(true); await install(); setAsking(false) }}>
          <Icon name="download" size={19} /> {asking ? 'Installing…' : 'Install BiteMark'}
        </button>
      ),
      note: 'Your phone asks once more: tap Install.',
    },
    ios: {
      title: 'Put BiteMark on your home screen',
      text: 'On iPhone and iPad it takes three taps:',
      steps: [
        <>Tap <Key><ShareGlyph /> Share</Key> (at the bottom in Safari, at the top in Chrome).</>,
        <>Scroll down and tap <b>Add to Home Screen</b>.</>,
        <>Tap <b>Add</b>. BiteMark is now on your home screen.</>,
      ],
    },
    'in-app': {
      title: 'Open this page in your browser first',
      text: 'Instagram, Facebook and other apps open links in their own browser, which can’t add apps to your phone.',
      steps: [
        <>Tap <Key><DotsGlyph /></Key> or <b>⋯</b> at the top.</>,
        <>Tap <b>Open in Chrome</b> (on iPhone: <b>Open in Safari</b>).</>,
        <>Install BiteMark from there.</>,
      ],
      action: <button className="btn w-full" onClick={copyLink}><Icon name={copied ? 'check' : 'copy'} size={17} /> {copied ? 'Link copied' : 'Copy the link instead'}</button>,
    },
    'android-menu': {
      title: 'Put BiteMark on your home screen',
      text: 'Add it from your browser’s menu:',
      steps: [
        <>Tap <Key><DotsGlyph /></Key> at the top right.</>,
        <>Tap <b>Install app</b> or <b>Add to Home screen</b>.</>,
        <>Tap <b>Install</b>.</>,
      ],
    },
    'desktop-menu': {
      title: 'Install BiteMark on this computer',
      text: 'It opens in its own window, like an app.',
      steps: [
        <>Click the install icon at the right end of the address bar, or open the browser menu <Key><DotsGlyph /></Key>.</>,
        <>Choose <b>Install BiteMark</b>, then <b>Install</b>.</>,
      ],
    },
    unsupported: {
      title: 'This browser can’t install apps',
      text: 'Open this link in Chrome or Edge to install BiteMark, or just use it right here.',
      action: <a href="/" className="btn btn-pri w-full !py-3 text-base">Open BiteMark</a>,
    },
  }[mode]

  return (
    <div className="fixed inset-0 overflow-y-auto overflow-x-hidden" style={{ background: 'var(--bg)' }}>
      <main className="flex min-h-full items-center justify-center px-4 py-6">
        <div className="w-full max-w-sm">
          {/* what they get: BiteMark among the apps on a home screen */}
          <div className="inst-home rise" aria-hidden="true">
            <span className="inst-tile" /><span className="inst-tile" />
            <span className="inst-app"><Logo size={64} /><span>BiteMark</span></span>
            <span className="inst-tile" />
          </div>

          <div className="card rise !p-5 sm:!p-6" style={{ animationDelay: '80ms', boxShadow: '0 1px 2px #0f172a0d, 0 12px 32px #0f172a14' }}>
            <h1 className="m-0 text-[22px] font-bold leading-tight tracking-tight">{body.title}</h1>
            <p className="m-0 mt-1.5 text-[15px] leading-relaxed" style={mute}>{body.text}</p>
            {body.steps && <Steps items={body.steps} />}
            {body.action && <div className="mt-5">{body.action}</div>}
            {body.note && <p className="m-0 mt-2 text-center text-xs" style={mute}>{body.note}</p>}
          </div>

          {mode !== 'installed' && mode !== 'unsupported' && (
            <p className="mt-4 text-center text-sm" style={mute}>
              or <a href="/" className="font-semibold" style={{ color: 'var(--pri)' }}>use BiteMark in the browser</a>
            </p>
          )}
        </div>
      </main>
    </div>
  )
}
