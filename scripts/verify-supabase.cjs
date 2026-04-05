const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Basic .env parsing
function loadEnv() {
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
          process.env[key.trim()] = value.trim();
        }
      });
    }
  } catch (e) {}
}

async function verify() {
  console.log('--- Supabase Connection Verify (JS) ---');
  loadEnv();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Error: Supabase keys not found in .env.local');
    process.exit(1);
  }

  console.log('✅ Keys found. URL:', supabaseUrl);

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  try {
    const { data, error } = await supabase
      .from('analyses')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Database Error:', error.message);
      process.exit(1);
    }

    console.log('✅ SUCCESS! Connection verified and "analyses" table is ready.');
    console.log('Current rows found:', data.length);
  } catch (e) {
    console.error('❌ Unexpected Error:', e.message);
    process.exit(1);
  }
}

verify();
