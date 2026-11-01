// The browser's built-in speech recognition (free; Chrome, Edge, Safari and Android). Firefox has
// none, so the mic is simply not offered there. Chrome sends the audio to its own speech service.

export function speechSupported(win) {
  return !!(win && (win.SpeechRecognition || win.webkitSpeechRecognition))
}

// browser error code -> what to tell the person ('' = not an error, e.g. they stopped it)
export function speechError(code) {
  if (code === 'aborted') return ''
  if (code === 'not-allowed' || code === 'service-not-allowed') return 'Microphone is blocked. Allow it for this site in your browser settings, then try again.'
  if (code === 'no-speech') return "Didn't catch anything. Tap the mic and speak a little closer."
  if (code === 'network') return 'Voice needs an internet connection.'
  if (code === 'audio-capture') return 'No microphone found.'
  return 'Voice stopped unexpectedly. Please try again.'
}

// Listen until you stop talking for a moment (or tap Done). Every pause becomes a separate piece,
// which the parser treats like a comma. Indian English understands Hinglish best.
export function listen({ onUpdate, onEnd, onError, silenceMs = 2500, maxMs = 45000 }) {
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition
  const rec = new Rec()
  rec.lang = 'en-IN'
  rec.continuous = true
  rec.interimResults = true
  let pieces = [], quiet, cap, ended = false
  const stop = () => { try { rec.stop() } catch {} }
  const hush = () => { clearTimeout(quiet); quiet = setTimeout(stop, silenceMs) }

  rec.onresult = e => {
    pieces = []
    let live = ''
    for (const r of e.results) (r.isFinal ? pieces.push(r[0].transcript.trim()) : (live += r[0].transcript))
    onUpdate(pieces, live.trim())
    hush()
  }
  rec.onerror = e => { const msg = speechError(e.error); if (msg) onError(msg) }
  rec.onend = () => { if (ended) return; ended = true; clearTimeout(quiet); clearTimeout(cap); onEnd(pieces.filter(Boolean)) }
  rec.start()
  hush()
  cap = setTimeout(stop, maxMs)
  return { stop, cancel: () => { ended = true; clearTimeout(quiet); clearTimeout(cap); try { rec.abort() } catch {} } }
}
