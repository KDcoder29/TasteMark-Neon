// On-device AI model for the "Craving?" chat: all-MiniLM-L6-v2 (sentence embeddings, ~25 MB,
// downloaded once from Hugging Face and cached by the browser). Free, private: nothing leaves the
// device. Each dish's vector is kept in IndexedDB under its text hash, so only new or edited dishes
// are ever processed again.
const MODEL = 'Xenova/all-MiniLM-L6-v2'
const DB = 'bitemark-ml', STORE = 'vecs'
let extractor = null

function loadModel(onProgress) {
  extractor ||= import('@huggingface/transformers').then(({ pipeline, env }) => {
    env.allowLocalModels = false
    return pipeline('feature-extraction', MODEL, { dtype: 'q8', progress_callback: onProgress })
  })
  return extractor
}

export async function embed(texts) {
  const ex = await loadModel()
  const out = await ex(texts, { pooling: 'mean', normalize: true })
  return out.tolist()
}

// --- tiny IndexedDB cache (best-effort: private mode etc. just means no cache) ---
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
const idb = (db, mode, fn) => new Promise((resolve, reject) => {
  const tx = db.transaction(STORE, mode), out = fn(tx.objectStore(STORE))
  tx.oncomplete = () => resolve(out?.result ?? out)
  tx.onerror = () => reject(tx.error)
})

// docs (from smartSearch.docsFromPlaces) -> { [doc.key]: vector }. onStatus('download' | 'index', n)
export async function buildIndex(docs, onStatus = () => {}) {
  let db = null
  try { db = await openDb() } catch { /* no cache available */ }
  const vecs = {}
  if (db) {
    const keys = docs.map(d => MODEL + '|' + d.key)
    const got = await idb(db, 'readonly', s => keys.map(k => s.get(k)))
    got.forEach((req, i) => { if (req.result) vecs[docs[i].key] = req.result })
  }
  const todo = docs.filter(d => !vecs[d.key])
  if (todo.length) {
    onStatus('download')
    await loadModel(p => { if (p.status === 'progress') onStatus('download', Math.round(p.progress || 0)) })
    for (let i = 0; i < todo.length; i += 32) {
      onStatus('index', Math.round((i / todo.length) * 100))
      const batch = todo.slice(i, i + 32)
      const out = await embed(batch.map(d => d.text))
      batch.forEach((d, j) => { vecs[d.key] = out[j] })
      if (db) await idb(db, 'readwrite', s => batch.forEach((d, j) => s.put(out[j], MODEL + '|' + d.key))).catch(() => {})
    }
  }
  // every dish was already cached: still load the model now (from the browser's cache, no
  // download) — otherwise the first question would pay ~3 s for it
  await loadModel()
  return vecs
}
