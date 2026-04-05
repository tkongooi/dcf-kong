import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

async function verify() {
  console.log('--- Supabase Connection Verify ---')
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Error: Supabase environment variables are missing in .env.local')
    process.exit(1)
  }

  console.log('✅ Environment variables found.')
  console.log('Connecting to:', supabaseUrl)

  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  const { data, error } = await supabase
    .from('analyses')
    .select('*')
    .limit(1)

  if (error) {
    console.error('❌ Database Error:', error.message)
    if (error.message.includes('relation "public.analyses" does not exist')) {
      console.error('👉 Suggestion: It looks like the "analyses" table hasn\'t been created yet. Please run the SQL script in Supabase.')
    }
    process.exit(1)
  }

  console.log('✅ Connection Successful! The "analyses" table is accessible.')
  console.log('Current row count (sample):', data.length)
}

verify()
