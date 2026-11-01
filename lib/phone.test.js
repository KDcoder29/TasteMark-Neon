import { describe, it, expect } from 'vitest'
import { findPhone, isPhone, telHref, pastedContact, PHONE_HINT } from '@/lib/phone'
import { placeFormError } from '@/lib/placeRules'

describe('findPhone: the contact number in whatever was copied from Google Maps', () => {
  it('finds Indian landlines and mobiles, written the usual ways', () => {
    expect(findPhone('079 2640 5900')).toBe('079 2640 5900')
    expect(findPhone('+91 79 2640 5900')).toBe('+91 79 2640 5900')
    expect(findPhone('098765 43210')).toBe('098765 43210')
    expect(findPhone('9876543210')).toBe('9876543210')
    expect(findPhone('+91-98765-43210')).toBe('+91-98765-43210')
    expect(findPhone('(0265) 233 4455')).toBe('(0265) 233 4455')
  })
  it('picks it out of a copied block, never the digits of the link', () => {
    const block = 'Swati Snacks\nLaw Garden, Ahmedabad 380006\nhttps://maps.app.goo.gl/AbC1234567890\n+91 79 2640 5900'
    expect(findPhone(block)).toBe('+91 79 2640 5900')
    expect(findPhone('https://maps.app.goo.gl/9876543210123')).toBe(null)
  })
  it('ignores prices, PIN codes, years and opening hours', () => {
    for (const t of ['₹ 450 for two', '380006', 'Since 2026', 'Open 11 am – 11 pm', 'Rating 4.5 (12,345)', ''])
      expect(findPhone(t)).toBe(null)
    expect(findPhone(null)).toBe(null)
  })
  it('the first number when there are two', () => {
    expect(findPhone('Call 079 2640 5900 or 98765 43210')).toBe('079 2640 5900')
  })
})

describe('isPhone: a typed contact number', () => {
  it('8 to 15 digits with the usual separators', () => {
    for (const ok of ['079 2640 5900', '+91 98765 43210', '0265-2334455', '(0265) 233 4455', '12345678'])
      expect(isPhone(ok)).toBe(true)
  })
  it('letters, too short or too long is not a number', () => {
    for (const bad of ['call me', '12345', '98765 4321O', '+91 1234567890123456', '079/2640'])
      expect(isPhone(bad)).toBe(false)
  })
})

describe('telHref: tap to call', () => {
  it('keeps only the digits and a leading +', () => {
    expect(telHref('079 2640 5900')).toBe('tel:07926405900')
    expect(telHref('+91 (79) 2640-5900')).toBe('tel:+917926405900')
  })
  it('nothing to call without a number', () => {
    expect(telHref('')).toBe(null)
    expect(telHref(null)).toBe(null)
  })
})

describe('pastedContact: one paste can fill both the number and the Maps link', () => {
  it('both from a copied block', () => {
    expect(pastedContact('Swati Snacks\nhttps://maps.app.goo.gl/AbC123\n079 2640 5900'))
      .toEqual({ phone: '079 2640 5900', link: 'https://maps.app.goo.gl/AbC123' })
  })
  it('just the number, or just the link', () => {
    expect(pastedContact('+91 98765 43210')).toEqual({ phone: '+91 98765 43210', link: null })
    expect(pastedContact('https://maps.app.goo.gl/AbC123')).toEqual({ phone: null, link: 'https://maps.app.goo.gl/AbC123' })
  })
})

describe('placeFormError: the contact number is optional', () => {
  const ok = { f: { name: 'Sankalp', city: 'Vadodara', area: 'Alkapuri', maps_url: '', phone: '' }, cats: ['Food'],
    dishes: [{ name: 'Dosa', price: 120, rating: 4, note: 'Crisp' }], editingGroup: false }
  it('empty is fine', () => {
    expect(placeFormError(ok)).toBe('')
    expect(placeFormError({ ...ok, f: { ...ok.f, phone: undefined } })).toBe('')
  })
  it('a real number is fine, something else asks to check it', () => {
    expect(placeFormError({ ...ok, f: { ...ok.f, phone: '079 2640 5900' } })).toBe('')
    expect(placeFormError({ ...ok, f: { ...ok.f, phone: 'call me' } })).toBe(PHONE_HINT)
  })
})
