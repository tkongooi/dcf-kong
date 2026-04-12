import { createClient, SupabaseClient } from '@supabase/supabase-js'

export const isSupabaseConfigured = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

// Only create a real client when configured; avoids confusing network errors from placeholder URLs
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  : createClient('https://placeholder.supabase.co', 'placeholder')
