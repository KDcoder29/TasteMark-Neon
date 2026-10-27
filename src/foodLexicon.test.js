import { describe, expect, test } from 'vitest'
import { expandQuery, dishWordIndex } from './foodLexicon'

describe('expandQuery', () => {
  test('knows that south indian means dosa, idli, uttapam…', () => {
    const { terms, topics } = expandQuery('south indian')
    expect(topics).toContain('South Indian')
    for (const d of ['dosa', 'idli', 'uttapam', 'vada', 'sambar']) expect(terms).toContain(d)
  })

  test('finds the topic inside a longer sentence, any case', () => {
    expect(expandQuery('I want some SOUTH Indian food tonight').topics).toContain('South Indian')
    expect(expandQuery('something chaat-y').topics).toContain('Chaat')
  })

  test('also works from a dish back to its family (dosa → South Indian)', () => {
    const { topics, terms } = expandQuery('masala dosa')
    expect(topics).toContain('South Indian')
    expect(terms).toContain('idli')
  })

  test('covers moods and meals, not just cuisines', () => {
    expect(expandQuery('something cold').terms).toEqual(expect.arrayContaining(['cold coffee', 'ice cream', 'shake']))
    expect(expandQuery('light breakfast').topics).toContain('Breakfast')
  })

  test('returns nothing extra for words it does not know', () => {
    expect(expandQuery('qwerty zzz')).toEqual({ topics: [], terms: [] })
    expect(expandQuery('')).toEqual({ topics: [], terms: [] })
  })
})

describe('dishWordIndex (where a dish name starts in a sentence)', () => {
  test('finds the first word of the earliest known dish', () => {
    expect(dishWordIndex('sankalp masala dosa')).toBe(1)
    expect(dishWordIndex('very crispy paneer tikka')).toBe(2)
    expect(dishWordIndex('crispy idli')).toBe(1)
    expect(dishWordIndex('coffea hazelnut cold coffee')).toBe(2)
  })

  test('0 when the sentence starts with a dish, -1 when there is none', () => {
    expect(dishWordIndex('idli sambar')).toBe(0)
    expect(dishWordIndex('sankalp special thali')).toBe(-1)
  })
})
