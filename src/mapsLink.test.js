import { describe, expect, test } from 'vitest'
import { isMapsLink, findMapsLink, mapsUrl } from './mapsLink'

describe('isMapsLink (only real Google Maps links are saved)', () => {
  test('the links people share from the Maps app and website', () => {
    expect(isMapsLink('https://maps.app.goo.gl/AbC123xyz')).toBe(true)
    expect(isMapsLink('https://goo.gl/maps/AbC123')).toBe(true)
    expect(isMapsLink('https://www.google.com/maps/place/Sankalp/@22.31,73.17,17z')).toBe(true)
    expect(isMapsLink('https://maps.google.com/?q=22.31,73.17')).toBe(true)
    expect(isMapsLink('https://www.google.co.in/maps/place/Sankalp')).toBe(true)
  })

  test('anything else is refused', () => {
    expect(isMapsLink('https://www.zomato.com/vadodara/sankalp')).toBe(false)
    expect(isMapsLink('http://maps.app.goo.gl/AbC')).toBe(false)              // not https
    expect(isMapsLink('https://www.google.com/search?q=sankalp')).toBe(false)
    expect(isMapsLink('https://evil.com/maps.app.goo.gl')).toBe(false)
    expect(isMapsLink('javascript:alert(1)')).toBe(false)
    expect(isMapsLink('')).toBe(false)
    expect(isMapsLink('https://maps.app.goo.gl/' + 'x'.repeat(600))).toBe(false)
  })
})

describe('findMapsLink (paste the whole WhatsApp message)', () => {
  test('picks the maps link out of shared text', () => {
    expect(findMapsLink('Sankalp Restaurant\nAlkapuri, Vadodara\nhttps://maps.app.goo.gl/AbC123xyz')).toBe('https://maps.app.goo.gl/AbC123xyz')
  })

  test('trailing punctuation is not part of the link', () => {
    expect(findMapsLink('try this: https://maps.app.goo.gl/AbC123.')).toBe('https://maps.app.goo.gl/AbC123')
    expect(findMapsLink('(https://maps.app.goo.gl/AbC123)')).toBe('https://maps.app.goo.gl/AbC123')
  })

  test('other links are skipped; no maps link gives null', () => {
    expect(findMapsLink('menu https://zomato.com/x and map https://goo.gl/maps/Q1')).toBe('https://goo.gl/maps/Q1')
    expect(findMapsLink('just a name')).toBe(null)
  })
})

describe('mapsUrl (what the Maps button opens)', () => {
  test('the exact link when one is saved', () => {
    expect(mapsUrl({ name: 'Sankalp', city: 'Vadodara', maps_url: 'https://maps.app.goo.gl/AbC' })).toBe('https://maps.app.goo.gl/AbC')
  })

  test('otherwise a Maps search for name, area and city', () => {
    expect(mapsUrl({ name: 'Bajrang Bhajiya', area: 'Nilamber circle', city: 'Vadodara' }))
      .toBe('https://www.google.com/maps/search/?api=1&query=Bajrang%20Bhajiya%2C%20Nilamber%20circle%2C%20Vadodara')
  })

  test('empty or placeholder area / city (like "-") are left out', () => {
    expect(mapsUrl({ name: 'Diet Coke', area: '-', city: 'Vadodara' }))
      .toBe('https://www.google.com/maps/search/?api=1&query=Diet%20Coke%2C%20Vadodara')
  })

  test('a broken saved link falls back to the search', () => {
    expect(mapsUrl({ name: 'X', maps_url: 'https://evil.com' })).toBe('https://www.google.com/maps/search/?api=1&query=X')
  })

  test('an exact position opens that spot (when no link is saved)', () => {
    expect(mapsUrl({ name: 'X', area: 'Alkapuri', city: 'Vadodara', lat: 22.31, lng: 73.17, loc_source: 'pin' }))
      .toBe('https://www.google.com/maps/search/?api=1&query=22.31%2C73.17')
  })

  test('an area-level position is not exact: search the name, area and city (Google finds the place)', () => {
    expect(mapsUrl({ name: 'X', area: 'Navrangpura', city: 'Ahmedabad', lat: 23.03, lng: 72.56, loc_source: 'area' }))
      .toBe('https://www.google.com/maps/search/?api=1&query=X%2C%20Navrangpura%2C%20Ahmedabad')
  })

  test('an old unchecked guess is ignored: search the name instead', () => {
    expect(mapsUrl({ name: 'X', lat: 22.31, lng: 73.17 })).toBe('https://www.google.com/maps/search/?api=1&query=X')
  })

  test('a saved link still wins over the position', () => {
    expect(mapsUrl({ name: 'X', lat: 22.31, lng: 73.17, maps_url: 'https://maps.app.goo.gl/AbC' })).toBe('https://maps.app.goo.gl/AbC')
  })

  test('nothing to search for: null (no button)', () => {
    expect(mapsUrl({ name: '  ' })).toBe(null)
    expect(mapsUrl(null)).toBe(null)
  })
})
