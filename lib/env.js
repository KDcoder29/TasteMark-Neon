// The two browser settings: where the Neon login server and data API live. Written as literal
// process.env.NEXT_PUBLIC_… reads so Next.js puts the values into the browser code at build time.
export const readEnv = src => ({
  AUTH_URL: src.NEXT_PUBLIC_NEON_AUTH_URL || '',
  DATA_API_URL: src.NEXT_PUBLIC_NEON_DATA_API_URL || '',
})

export const { AUTH_URL, DATA_API_URL } = readEnv({
  NEXT_PUBLIC_NEON_AUTH_URL: process.env.NEXT_PUBLIC_NEON_AUTH_URL,
  NEXT_PUBLIC_NEON_DATA_API_URL: process.env.NEXT_PUBLIC_NEON_DATA_API_URL,
})
