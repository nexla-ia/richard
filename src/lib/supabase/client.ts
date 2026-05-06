import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Credenciais com fallback direto caso .env não carregue
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
  ?? 'https://seotduhwhcgndnufqreo.supabase.co'

const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
  ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlb3RkdWh3aGNnbmRudWZxcmVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMzM2NDQsImV4cCI6MjA4OTYwOTY0NH0.fdkUVpsFHrG_cTy9599OyH_Cv98A9rQYDXnCcqfUWd0'

console.log('[Supabase] URL:', SUPABASE_URL)
console.log('[Supabase] Key definida:', !!SUPABASE_ANON_KEY)

let _client: ReturnType<typeof createSupabaseClient> | null = null

export function createClient() {
  if (!_client) {
    _client = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  }
  return _client
}
