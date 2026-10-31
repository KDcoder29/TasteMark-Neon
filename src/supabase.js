// Neon client. The file and export keep the old "supabase" name on purpose, so the rest of the
// app (Journal, Groups, ...) works unchanged: same from().select().eq() calls, same rpc().
import { createClient, SupabaseAuthAdapter } from '@neondatabase/neon-js'
import { AUTH_URL, DATA_API_URL } from './env'

export const supabase = createClient({
  auth: { adapter: SupabaseAuthAdapter(), url: AUTH_URL || undefined },
  dataApi: { url: DATA_API_URL || undefined },
})
