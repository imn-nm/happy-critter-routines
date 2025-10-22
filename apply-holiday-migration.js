// Script to apply the holidays table migration
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = "https://csocuioanbuomhrcbqag.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzb2N1aW9hbmJ1b21ocmNicWFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxODA5OTcsImV4cCI6MjA3Mjc1Njk5N30.AjKy8leu7cvfnpWqtczevpIy1yr3FtI4rCBKKL7Jotk";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function applyMigration() {
  try {
    console.log('Reading migration file...');
    const migrationPath = path.join(__dirname, 'supabase/migrations/20251022000000_create_holidays_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Applying migration...');
    console.log('\nNote: This script uses the anon key which may not have permissions to run DDL statements.');
    console.log('You may need to run this migration manually in the Supabase SQL Editor.');
    console.log('\nMigration SQL:');
    console.log('------------------------------------------------------------');
    console.log(migrationSQL);
    console.log('------------------------------------------------------------');
    console.log('\nTo apply this migration:');
    console.log('1. Go to https://supabase.com/dashboard/project/csocuioanbuomhrcbqag/sql/new');
    console.log('2. Copy and paste the SQL above');
    console.log('3. Click "Run"');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

applyMigration();
