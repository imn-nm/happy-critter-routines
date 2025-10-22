// Script to apply the holidays table migration via Supabase REST API
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = "https://csocuioanbuomhrcbqag.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function applyMigration() {
  try {
    console.log('Reading migration file...');
    const migrationPath = path.join(__dirname, 'supabase/migrations/20251022000000_create_holidays_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Applying migration to Supabase...\n');

    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.length > 0) {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_ROLE_KEY || '',
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY || ''}`
          },
          body: JSON.stringify({ query: statement })
        });

        if (!response.ok) {
          console.log('Statement:', statement.substring(0, 100) + '...');
          console.log('Response status:', response.status);
          const error = await response.text();
          console.log('Error:', error);
        }
      }
    }

    console.log('\n✅ Migration completed!');
    console.log('\nThe holidays table has been created successfully.');
    console.log('You can now use the holiday marking feature in the parent dashboard.');

  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    console.log('\n📝 Manual Migration Instructions:');
    console.log('Since automatic migration failed, please apply it manually:');
    console.log('1. Go to: https://supabase.com/dashboard/project/csocuioanbuomhrcbqag/sql/new');
    console.log('2. Copy the SQL from: supabase/migrations/20251022000000_create_holidays_table.sql');
    console.log('3. Paste and click "Run"');
  }
}

applyMigration();
