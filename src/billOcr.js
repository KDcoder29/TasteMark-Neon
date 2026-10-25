// Reads the text on a bill photo, for free, right on the device (Tesseract.js: no server,
// no API key, no per-bill cost). The first scan downloads the English reading data (a few MB)
// from a public CDN; the browser caches it after that.
//
// Free OCR struggles with faded thermal paper, so the photo is cleaned up first:
// resized to a readable size, turned gray, and its contrast stretched.

const MAX_SIDE = 2400   // bigger only slows phones down without reading better
const MIN_SIDE = 1600   // smaller than this and receipt text gets too thin to read

// how much to resize a w x h photo before reading it
export function scaleFor(w, h) {
  const long = Math.max(w, h)
  if (long > MAX_SIDE) return MAX_SIDE / long
  if (long < MIN_SIDE) return Math.min(2, MAX_SIDE / long)
  return 1
}

// RGBA pixels -> gray with stretched contrast, in place. The darkest ~1% becomes black and the
// brightest ~1% white, so faint ink stands out against yellowed paper.
export function enhancePixels(data) {
  const n = data.length / 4
  const gray = new Uint8ClampedArray(n)
  const hist = new Uint32Array(256)
  for (let i = 0; i < n; i++) {
    const g = Math.round(0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2])
    gray[i] = g; hist[g]++
  }
  const cut = Math.floor(n * 0.01)
  let lo = 0, hi = 255, seen = 0
  while (lo < 255 && seen + hist[lo] <= cut) seen += hist[lo++]
  seen = 0
  while (hi > 0 && seen + hist[hi] <= cut) seen += hist[hi--]
  const span = hi - lo
  for (let i = 0; i < n; i++) {
    const v = span > 0 ? ((gray[i] - lo) * 255) / span : gray[i]
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v
  }
  return data
}

async function prepare(file) {
  const img = await createImageBitmap(file)
  const s = scaleFor(img.width, img.height)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * s)
  canvas.height = Math.round(img.height * s)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  img.close?.()
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
  enhancePixels(pixels.data)
  ctx.putImageData(pixels, 0, 0)
  return canvas
}

// photo file -> raw text. onProgress gets 0..1 while it reads.
export async function readBillText(file, onProgress = () => {}) {
  const { createWorker } = await import('tesseract.js')   // only downloaded when someone scans
  const canvas = await prepare(file)
  const worker = await createWorker('eng', 1, {
    logger: m => { if (m.status === 'recognizing text') onProgress(m.progress) },
  })
  try {
    // "6" = one uniform block of text. Tested on a faded receipt: it keeps each dish and its
    // right-aligned price on the same line, while "4" (single column) split some rows apart
    // and lost their prices, and "3"/"11" (auto / sparse) found no dish lines at all.
    await worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' })
    const { data } = await worker.recognize(canvas)
    return data.text || ''
  } finally {
    await worker.terminate()
  }
}
