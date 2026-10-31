import { describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { FEATURES, ACTIONS } from './features'

const all = FEATURES.flatMap(g => g.items)

describe('the feature guide', () => {
  test('covers every feature the app has', () => {
    const titles = all.map(f => f.title.toLowerCase()).join(' | ')
    for (const word of ['bill', 'say it', 'craving', 'where to eat', 'want to try', 'group', 'send', 'filter', 'food story', 'order again', 'pull', 'swipe', 'near me', 'find on google maps', 'paste link'])
      expect(titles + ' | ' + all.map(f => f.text.toLowerCase()).join(' ')).toContain(word)
  })

  test('every item has an icon, a title and one plain sentence', () => {
    for (const f of all) {
      expect(f.icon && f.title && f.text).toBeTruthy()
      expect(f.text.length).toBeLessThan(170)
    }
  })

  test('titles are unique', () => {
    expect(new Set(all.map(f => f.title)).size).toBe(all.length)
  })

  test('maps texts match how they work now: city chips, automatic placement by landmark, Directions', () => {
    const text = t => all.find(f => f.title === t)?.text.toLowerCase() || ''
    expect(text('Near me')).toContain('city')
    expect(text('Near me')).toContain('km')
    expect(text('Exact location')).toContain('landmark')
    expect(text('Directions')).not.toContain('paste')
  })

  test('the guide covers the map features: share, route, heatmap, replay', () => {
    const blob = all.map(f => f.title + ' ' + f.text).join(' ').toLowerCase()
    for (const word of ['share', 'route', 'heatmap', 'replay', 'are you at']) expect(blob).toContain(word)
    const src = readFileSync(new URL('./Icons.jsx', import.meta.url), 'utf8')
    for (const f of all) expect(src).toMatch(new RegExp(`^\\s*${f.icon}\\s*:`, 'm'))
  })

  test('Near me can be tried from the guide', () => {
    expect(all.find(f => f.title === 'Near me')?.action).toBe('near')
  })

  test('every "Try it" opens something the app knows how to open', () => {
    for (const f of all) if (f.action) expect(ACTIONS).toContain(f.action)
  })
})
