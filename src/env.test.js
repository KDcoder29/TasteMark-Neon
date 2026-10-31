import { describe, expect, test } from 'vitest'
import { readEnv } from './env'

describe('browser settings (Neon login and data URLs)', () => {
  test('read from the NEXT_PUBLIC_ variables', () => {
    expect(readEnv({ NEXT_PUBLIC_NEON_AUTH_URL: 'https://a', NEXT_PUBLIC_NEON_DATA_API_URL: 'https://d' }))
      .toEqual({ AUTH_URL: 'https://a', DATA_API_URL: 'https://d' })
  })
  test('missing ones are empty, never a crash', () => {
    expect(readEnv({})).toEqual({ AUTH_URL: '', DATA_API_URL: '' })
  })
})
