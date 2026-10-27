import { describe, expect, test } from 'vitest'
import { speechSupported, speechError } from './speech'

describe('speechSupported', () => {
  test('Chrome / Edge / Android (prefixed) and newer browsers (unprefixed)', () => {
    expect(speechSupported({ webkitSpeechRecognition: function () {} })).toBe(true)
    expect(speechSupported({ SpeechRecognition: function () {} })).toBe(true)
  })

  test('Firefox and old browsers have none: the mic button is hidden', () => {
    expect(speechSupported({})).toBe(false)
    expect(speechSupported(undefined)).toBe(false)
  })
})

describe('speechError (plain words for what went wrong)', () => {
  test('blocked microphone says how to fix it', () => {
    expect(speechError('not-allowed')).toMatch(/allow/i)
    expect(speechError('service-not-allowed')).toMatch(/allow/i)
  })

  test('silence and no internet', () => {
    expect(speechError('no-speech')).toMatch(/didn.t catch/i)
    expect(speechError('network')).toMatch(/internet/i)
  })

  test('the user stopping it is not an error', () => {
    expect(speechError('aborted')).toBe('')
  })

  test('anything else gets a general message', () => {
    expect(speechError('weird')).toMatch(/try again/i)
  })
})
