const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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

async function listTables() {
  loadEnv();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  console.log('--- Listing Tables ---');
  // This is a common way to check if we can access the DB and what's in it
  // using an RPC call or just checking a known table
  const { data, error } = await supabase.from('analyses').select('count');
  
  if (error) {
    console.log('Error from "analyses":', error.message);
  } else {
    console.log('✅ "analyses" table found!');
  }
}

listTables();
