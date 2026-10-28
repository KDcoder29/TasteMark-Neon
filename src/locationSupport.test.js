import { describe, expect, test } from 'vitest'
import { checkLocationSupport, pasteMapsLink, showFixHint, findOnGoogleUrl } from './locationSupport'

const client = result => ({ from: () => ({ select: () => ({ limit: async () => result }) }) })

describe('checkLocationSupport (has the location migration run?)', () => {
  test('the column answers: ready', async () => {
    expect(await checkLocationSupport(client({ data: [], error: null }))).toBe(true)
  })
  test('"column places.loc_source does not exist": not ready', async () => {
    expect(await checkLocationSupport(client({ error: { code: '42703', message: 'column places.loc_source does not exist' } }))).toBe(false)
    expect(await checkLocationSupport(client({ error: { code: 'PGRST204', message: "Could not find the 'loc_source' column of 'places' in the schema cache" } }))).toBe(false)
  })
  test('offline or anything else: unknown (null), so nothing is hidden by mistake', async () => {
    expect(await checkLocationSupport(client({ error: { message: 'Failed to fetch' } }))).toBe(null)
    expect(await checkLocationSupport({ from: () => { throw new Error('boom') } })).toBe(null)
  })
})

describe('pasteMapsLink (the "Paste link" button)', () => {
  test('a copied Google Maps link, even inside a longer WhatsApp-style text', async () => {
    expect(await pasteMapsLink({ readText: async () => 'Mandap\nhttps://maps.app.goo.gl/AbC123' })).toEqual({ link: 'https://maps.app.goo.gl/AbC123' })
  })
  test('something else on the clipboard', async () => {
    expect(await pasteMapsLink({ readText: async () => 'hello' })).toEqual({ error: 'not-maps' })
    expect(await pasteMapsLink({ readText: async () => '' })).toEqual({ error: 'empty' })
  })
  test('the browser refuses, or cannot read the clipboard', async () => {
    expect(await pasteMapsLink({ readText: async () => { throw new Error('NotAllowedError') } })).toEqual({ error: 'blocked' })
    expect(await pasteMapsLink(undefined)).toEqual({ error: 'blocked' })
  })
})

describe('showFixHint (the quiet "N places have no exact location" line)', () => {
  test('shown when there are places to fix and it was never hidden', () => {
    expect(showFixHint(5, null)).toBe(true)
    expect(showFixHint(0, null)).toBe(false)
  })
  test('hidden with × stays hidden, until more places need one than when it was hidden', () => {
    expect(showFixHint(5, 5)).toBe(false)
    expect(showFixHint(3, 5)).toBe(false)
    expect(showFixHint(6, 5)).toBe(true)
  })
})

test('findOnGoogleUrl: a Google Maps search for the name, area and city (what opens perfectly)', () => {
  expect(findOnGoogleUrl({ name: 'Mandap', area: 'Express Hotel, Alkapuri', city: 'Vadodara' }))
    .toBe('https://www.google.com/maps/search/?api=1&query=Mandap%2C%20Express%20Hotel%2C%20Alkapuri%2C%20Vadodara')
  expect(findOnGoogleUrl({ name: '  ' })).toBe(null)
})
