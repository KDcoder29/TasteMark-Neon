import { describe, expect, test } from 'vitest'
import { enhancePixels, scaleFor, stageOf, inkRatio, linesOf, headCut } from '@/lib/billOcr'

describe('stageOf', () => {
  test('is "download" while the language data is still coming in (first scan)', () => {
    expect(stageOf({ status: 'loading language traineddata', progress: 0.4 })).toBe('download')
  })

  test('is "prepare" while the reader starts up', () => {
    expect(stageOf({ status: 'loading tesseract core', progress: 0 })).toBe('prepare')
    expect(stageOf({ status: 'initializing tesseract', progress: 1 })).toBe('prepare')
    expect(stageOf({ status: 'loading language traineddata', progress: 1 })).toBe('prepare')
    expect(stageOf({ status: 'initializing api', progress: 0.5 })).toBe('prepare')
  })

  test('is "read" while the text is being recognised', () => {
    expect(stageOf({ status: 'recognizing text', progress: 0.3 })).toBe('read')
  })

  test('is null for anything else', () => {
    expect(stageOf({ status: 'something new', progress: 0 })).toBe(null)
    expect(stageOf(undefined)).toBe(null)
  })
})

const px = (...rgb) => new Uint8ClampedArray(rgb.flatMap(([r, g, b]) => [r, g, b, 255]))
const grays = data => [...data].filter((_, i) => i % 4 === 0)

describe('enhancePixels', () => {
  test('turns colour into gray (red, green and blue end up equal)', () => {
    const data = px([200, 120, 40], [10, 10, 10], [250, 250, 250])
    enhancePixels(data)
    for (let i = 0; i < data.length; i += 4) {
      expect(data[i]).toBe(data[i + 1])
      expect(data[i]).toBe(data[i + 2])
    }
  })

  test('stretches a faded receipt so the ink is near black and the paper near white', () => {
    const data = px([110, 110, 110], [130, 130, 130], [150, 150, 150], [190, 190, 190], [200, 200, 200])
    enhancePixels(data)
    const g = grays(data)
    expect(g[0]).toBeLessThan(20)
    expect(g[4]).toBeGreaterThan(235)
    expect(g).toEqual([...g].sort((a, b) => a - b))   // order of brightness is kept
  })

  test('leaves alpha alone and does not blow up on a flat image', () => {
    const data = px([128, 128, 128], [128, 128, 128])
    enhancePixels(data)
    expect(data[3]).toBe(255)
    expect(Number.isFinite(data[0])).toBe(true)
  })
})

describe('scaleFor', () => {
  test('enlarges small photos so the text is big enough to read', () => {
    expect(scaleFor(800, 1200)).toBe(2)
  })

  test('shrinks very large photos to keep phones fast', () => {
    expect(scaleFor(4000, 3000)).toBeCloseTo(2400 / 4000)
  })

  test('keeps photos that are already a good size', () => {
    expect(scaleFor(1800, 2400)).toBe(1)
  })
})

describe('inkRatio: how much of a line is ink (bold text has thicker strokes)', () => {
  // a 10 x 4 gray image (one value per pixel, RGBA): 0 = black ink, 255 = paper
  const img = (dark) => { const d = new Uint8ClampedArray(10 * 4 * 4).fill(255); for (const [x, y] of dark) d.fill(0, (y * 10 + x) * 4, (y * 10 + x) * 4 + 3); return d }
  test('counts the dark pixels inside the box only', () => {
    const d = img([[1, 1], [2, 1], [8, 3]])
    expect(inkRatio(d, 10, { x0: 0, y0: 0, x1: 5, y1: 2 })).toBeCloseTo(2 / 10)
  })
  test('an empty or off-page box is 0, never a crash', () => {
    expect(inkRatio(img([]), 10, { x0: 3, y0: 1, x1: 3, y1: 1 })).toBe(0)
    expect(inkRatio(img([]), 10, { x0: 50, y0: 50, x1: 60, y1: 60 })).toBe(0)
  })
})

describe('linesOf: the reader result -> printed lines with their boxes', () => {
  test('flattens blocks -> paragraphs -> lines, in order, without empty lines', () => {
    const blocks = [{ paragraphs: [
      { lines: [{ text: 'SANKALP\n', bbox: { x0: 1, y0: 2, x1: 3, y1: 4 } }, { text: '  \n', bbox: { x0: 0, y0: 0, x1: 0, y1: 0 } }] },
      { lines: [{ text: 'Dosa 120\n', bbox: { x0: 5, y0: 6, x1: 7, y1: 8 } }] },
    ] }]
    expect(linesOf(blocks)).toEqual([
      { text: 'SANKALP', x0: 1, y0: 2, x1: 3, y1: 4 },
      { text: 'Dosa 120', x0: 5, y0: 6, x1: 7, y1: 8 },
    ])
    expect(linesOf(null)).toEqual([])
  })
})

describe('headCut: how much of the top to read again for the name', () => {
  const line = (text, y0) => ({ text, x0: 0, y0, x1: 100, y1: y0 + 20 })
  test('down to the first dish line', () => {
    expect(headCut([line('GSTIN 24AAB', 140), line('Masala Dosa  2  120  240', 280), line('Total 300', 400)], 1200)).toBe(280)
  })
  test('no dish line found: the top 40% of the bill', () => {
    expect(headCut([line('GSTIN 24AAB', 140)], 1200)).toBe(480)
    expect(headCut([], 1000)).toBe(400)
  })
})

