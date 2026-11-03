import { parseBillText } from '@/lib/billParse'

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
  return { canvas, pixels: pixels.data }
}

// Share of dark pixels inside a line's box (RGBA pixels already turned gray, see enhancePixels).
// Bold print has thicker strokes, so its lines carry more ink than the body text (lib/billName).
export function inkRatio(data, width, { x0, y0, x1, y1 }) {
  const height = data.length / 4 / width
  const l = Math.max(0, Math.floor(x0)), r = Math.min(width, Math.ceil(x1))
  const t = Math.max(0, Math.floor(y0)), b = Math.min(height, Math.ceil(y1))
  if (r <= l || b <= t) return 0
  let dark = 0
  for (let y = t; y < b; y++) for (let x = l; x < r; x++) if (data[(y * width + x) * 4] < 128) dark++
  return dark / ((r - l) * (b - t))
}

// the reader's blocks -> paragraphs -> lines, as printed lines with their boxes
export function linesOf(blocks) {
  return (blocks || []).flatMap(b => b.paragraphs || []).flatMap(p => p.lines || [])
    .map(l => ({ text: (l.text || '').trim(), ...l.bbox }))
    .filter(l => l.text)
}

// Tesseract's progress messages -> what the person is waiting for. Its percentages only cover the
// final "recognizing text" step (and jump 1% -> 63% there), so we show steps, not a percentage.
const PREPARE = ['loading tesseract core', 'initializing tesseract', 'loading language traineddata', 'initializing api']
export function stageOf(m) {
  if (!m) return null
  if (m.status === 'recognizing text') return 'read'
  if (m.status === 'loading language traineddata' && m.progress < 1) return 'download'
  return PREPARE.includes(m.status) ? 'prepare' : null
}

// Where the name pass stops: the first dish line (the name is printed above the items), else the
// top 40% of the bill.
export function headCut(lines, height) {
  const dish = lines.find(l => parseBillText(l.text).length)
  return Math.round(dish ? dish.y0 : height * 0.4)
}

// photo file -> { text, lines, width }: the raw text, and each printed line with its box and ink
// (for finding the restaurant name, lib/billName). onStage gets 'prepare' | 'download' | 'read'.
export async function readBillText(file, onStage = () => {}) {
  onStage('prepare')
  const { createWorker } = await import('tesseract.js')   // only downloaded when someone scans
  const { canvas, pixels } = await prepare(file)
  const worker = await createWorker('eng', 1, {
    logger: m => { const s = stageOf(m); if (s) onStage(s) },
  })
  try {
    // "6" = one uniform block of text. Tested on a faded receipt: it keeps each dish and its
    // right-aligned price on the same line, while "4" (single column) split some rows apart
    // and lost their prices, and "3"/"11" (auto / sparse) found no dish lines at all.
    await worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' })
    const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true })
    const body = linesOf(data.blocks)
    // That mode drops lines much bigger than the rest, like a big printed restaurant name. So the top
    // of the bill is read again on its own in auto mode ("3"), which keeps headlines (lib/billName).
    // A cropped copy, not the reader's `rectangle` option: tested, that one returned garbled text.
    const cut = headCut(body, canvas.height)
    let head = []
    if (cut > 20) {
      const top = document.createElement('canvas')
      top.width = canvas.width; top.height = cut
      top.getContext('2d').drawImage(canvas, 0, 0)
      await worker.setParameters({ tessedit_pageseg_mode: '3' })
      head = linesOf((await worker.recognize(top, {}, { blocks: true })).data.blocks)
    }
    const lines = [...head, ...body.filter(l => l.y0 >= cut)].map(l => ({ ...l, ink: inkRatio(pixels, canvas.width, l) }))
    return { text: data.text || '', lines, width: canvas.width }
  } finally {
    await worker.terminate()
  }
}
