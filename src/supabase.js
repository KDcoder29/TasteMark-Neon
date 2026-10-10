// Neon client. The file and export keep the old "supabase" name on purpose, so the rest of the
// app (Journal, Groups, ...) works unchanged: same from().select().eq() calls, same rpc().
import { createClient, SupabaseAuthAdapter } from '@neondatabase/neon-js'

export const supabase = createClient({
  auth: { adapter: SupabaseAuthAdapter(), url: import.meta.env.VITE_NEON_AUTH_URL },
  dataApi: { url: import.meta.env.VITE_NEON_DATA_API_URL },
})
