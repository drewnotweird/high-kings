import type { SupabaseClient } from '@supabase/supabase-js'

// Supabase is ~52KB gzipped and most visitors are guests who never sign in or
// play online, so it's loaded on demand rather than as part of the entry graph.
// Anything that genuinely needs it awaits getSupabase().

let clientPromise: Promise<SupabaseClient> | null = null
let client: SupabaseClient | null = null
const waiting: ((c: SupabaseClient) => void)[] = []

export function getSupabase(): Promise<SupabaseClient> {
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) => {
      client = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
      waiting.splice(0).forEach(cb => cb(client!))
      return client
    })
  }
  return clientPromise
}

// Has this browser ever signed in? Supabase keeps its session under
// `sb-<project-ref>-auth-token`, so checking for that lets a guest skip the
// download entirely while a returning user still gets their session restored.
export function hasStoredSession(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) return true
    }
  } catch { /* storage blocked — treat as no session */ }
  return false
}

// Runs cb once a client exists: immediately if it's already loaded, otherwise
// when something else (sign-in, lobby, leaderboard) first pulls it in. Lets the
// app attach its auth listener without forcing the load itself.
export function whenSupabaseReady(cb: (c: SupabaseClient) => void): () => void {
  if (client) { cb(client); return () => {} }
  waiting.push(cb)
  return () => { const i = waiting.indexOf(cb); if (i >= 0) waiting.splice(i, 1) }
}
