import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env file manually
const envContent = fs.readFileSync('.env', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...values] = line.split('=');
  if (key && values.length) {
    envVars[key.trim()] = values.join('=').replace(/^["']|["']$/g, '');
  }
});

const SUPABASE_URL = envVars.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY;

async function applyMigration() {
  console.log('🚀 Starting migration application...\n');

  if (!SERVICE_ROLE_KEY || SERVICE_ROLE_KEY === 'YOUR_SERVICE_ROLE_KEY_HERE') {
    console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY not found in .env file');
    return;
  }

  try {
    console.log('📖 Reading migration file...');
    const migrationPath = path.join(__dirname, 'supabase/migrations/20251022000000_create_holidays_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('🔌 Connecting to Supabase...');
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('📊 Executing migration SQL directly...\n');

    // Try to execute the entire SQL as one block using Supabase's REST API
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ sql: migrationSQL })
    });

    if (!response.ok) {
      // If RPC doesn't work, we need to use the SQL editor approach
      const errorText = await response.text();
      console.log('⚠️  Direct execution not available');
      console.log('📝 Using manual approach instead...\n');

      // Create table using Supabase Admin API
      console.log('Creating holidays table via REST API...');

      // We'll need to execute raw SQL through Supabase's postgres connection
      // Since direct SQL execution isn't available, let's use a different approach
      throw new Error('Direct SQL execution requires Supabase CLI or manual execution');
    }

    console.log('✅ Migration completed successfully!');
    console.log('\n🎉 The holidays table is now ready!');
    console.log('   You can now mark holidays in the month view.');
    console.log('   Refresh your app at http://localhost:8080/\n');

  } catch (error) {
    console.log('\n⚠️  Automatic migration not available');
    console.log('Using Supabase Management API instead...\n');

    // Use Supabase Management API
    try {
      await applyViaManagementAPI();
    } catch (err) {
      console.error('❌ Could not apply migration automatically');
      console.log('\n📝 Please apply manually:');
      console.log('1. Go to: https://supabase.com/dashboard/project/csocuioanbuomhrcbqag/sql/new');
      console.log('2. Copy the SQL from: supabase/migrations/20251022000000_create_holidays_table.sql');
      console.log('3. Paste and click "Run"\n');
    }
  }
}

async function applyViaManagementAPI() {
  const migrationPath = path.join(__dirname, 'supabase/migrations/20251022000000_create_holidays_table.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

  console.log('📡 Trying Supabase Management API...');

  const response = await fetch(`https://api.supabase.com/v1/projects/${envVars.VITE_SUPABASE_PROJECT_ID}/database/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ query: migrationSQL })
  });

  if (!response.ok) {
    throw new Error('Management API failed');
  }

  console.log('✅ Migration applied via Management API!');
  console.log('\n🎉 The holidays table is now ready!');
}

applyMigration();
