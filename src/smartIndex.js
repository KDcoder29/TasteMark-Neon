// Prepares the Craving chat's AI in the background right after login, so it is usually ready
// before the chat is opened. One shared job: the background start and the chat both call
// ensure(docs) and the work runs once. While the journal is re-read after a change, the previous
// vectors stay usable.

export function createIndexer(build) {
  let state = { state: 'idle' }, vecs = null, sig = null, running = null
  const subs = new Set()
  const set = s => { state = s; subs.forEach(f => f(s)) }

  return {
    get: () => ({ ...state, vecs }),
    subscribe(f) { subs.add(f); return () => subs.delete(f) },
    ensure(docs) {
      const s = docs.map(d => d.key).sort().join(',')
      if (s === sig && running) return running
      sig = s
      set({ state: 'loading' })
      running = build(docs, (step, pct) => { if (sig === s) set({ state: 'loading', step, pct }) })
        .then(v => { if (sig === s) { vecs = v; set({ state: 'ready' }) } return v })
        .catch(err => { console.error(err); if (sig === s) { set({ state: 'off' }); running = null } return null })
      return running
    },
  }
}

// Data Saver on, or a 2G-class connection: don't spend ~25 MB in the background — wait until
// the chat is actually opened.
export const shouldAutoWarm = nav =>
  !(nav?.connection?.saveData || /(^|-)2g$/.test(nav?.connection?.effectiveType || ''))

// the app-wide job; the model code itself is only fetched when the job first runs
export const smartIndex = createIndexer((docs, on) => import('./embedder').then(m => m.buildIndex(docs, on)))
