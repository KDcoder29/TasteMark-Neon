// Direct calls to the Neon Auth (Better Auth) endpoints for things the Supabase-style adapter
// does not cover: choosing a new password from a reset link, and changing your password.
const BASE = (import.meta.env.VITE_NEON_AUTH_URL || '').replace(/\/$/, '')

async function post(path, body, token) {
  let r
  try {
    r = await fetch(`${BASE}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    })
  } catch { throw new Error('Could not reach the server. Please try again.') }
  let data = null
  try { data = await r.json() } catch {}
  if (!r.ok) {
    const code = data?.code || ''
    if (/INVALID_TOKEN|TOKEN/i.test(code)) throw new Error('This reset link is invalid or has expired. Please request a new one.')
    if (/INVALID_PASSWORD/i.test(code)) throw new Error('Your current password is incorrect.')
    if (/PASSWORD_TOO_SHORT/i.test(code)) throw new Error('Password is too short.')
    throw new Error(data?.message || 'Something went wrong. Please try again.')
  }
  return data
}

export const resetPassword = (token, newPassword) => post('/reset-password', { token, newPassword })
export const changePassword = (currentPassword, newPassword, token) =>
  post('/change-password', { currentPassword, newPassword, revokeOtherSessions: false }, token)
