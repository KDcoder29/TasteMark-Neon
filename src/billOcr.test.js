import { describe, expect, test } from 'vitest'
import { enhancePixels, scaleFor, stageOf } from './billOcr'

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
