import { createClient, SupabaseClient } from '@supabase/supabase-js'

export const isSupabaseConfigured = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

const throwingProxy = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    throw new Error(
      `Supabase is not configured: tried to access "${String(prop)}". ` +
      `Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local. ` +
      `Always gate calls on isSupabaseConfigured before using this client.`
    )
  },
})

export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  : throwingProxy
