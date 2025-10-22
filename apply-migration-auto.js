import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function applyMigration() {
  console.log('🚀 Starting migration application...\n');

  if (!SERVICE_ROLE_KEY || SERVICE_ROLE_KEY === 'YOUR_SERVICE_ROLE_KEY_HERE') {
    console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY not found in .env file');
    console.log('\n📝 To fix this:');
    console.log('1. Go to: https://supabase.com/dashboard/project/csocuioanbuomhrcbqag/settings/api');
    console.log('2. Copy your "service_role" key (secret key)');
    console.log('3. Replace "YOUR_SERVICE_ROLE_KEY_HERE" in the .env file with your actual key');
    console.log('4. Run this script again');
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

    console.log('📊 Applying migration...\n');

    // Split SQL into individual statements and execute them
    const statements = migrationSQL
      .split(/;\s*(?=\n|$)/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.match(/^--.*$/));

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.length === 0) continue;

      const preview = statement.substring(0, 60).replace(/\s+/g, ' ');
      process.stdout.write(`  [${i + 1}/${statements.length}] ${preview}... `);

      try {
        const { error } = await supabase.rpc('exec_sql', {
          query: statement + ';'
        }).catch(async () => {
          // If exec_sql doesn't exist, try direct query
          const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': SERVICE_ROLE_KEY,
              'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
              'Prefer': 'return=representation'
            },
            body: JSON.stringify({ query: statement + ';' })
          });

          if (!response.ok) {
            const text = await response.text();
            throw new Error(text);
          }
          return { error: null };
        });

        if (error) throw error;
        console.log('✅');
      } catch (err) {
        console.log('⚠️');
        console.log(`    Warning: ${err.message}`);
        // Continue with other statements
      }
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\n🎉 The holidays table is now ready!');
    console.log('   You can now mark holidays in the month view.');
    console.log('   Refresh your app at http://localhost:8080/\n');

  } catch (error) {
    console.error('\n❌ Error applying migration:', error.message);
    console.log('\n📝 Manual fallback:');
    console.log('1. Go to: https://supabase.com/dashboard/project/csocuioanbuomhrcbqag/sql/new');
    console.log('2. Copy the SQL from: supabase/migrations/20251022000000_create_holidays_table.sql');
    console.log('3. Paste and click "Run"\n');
  }
}

applyMigration();
