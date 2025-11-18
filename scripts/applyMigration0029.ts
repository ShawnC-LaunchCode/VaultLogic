import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;

// Load environment variables
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set. Did you forget to provision a database?');
}

async function applyMigration() {
  console.log('🔄 Applying migration 0029 (Fix survey_status enum)...');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'migrations', '0029_fix_survey_status_enum.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📄 Migration file loaded');

    // Execute the migration
    console.log('⚙️  Executing migration...');
    await pool.query(migrationSQL);

    console.log('✅ Migration 0029 applied successfully!');
    console.log('✨ survey_status enum updated:');
    console.log('   - Added "active" to survey_status enum');
    console.log('   - Added "archived" to survey_status enum');
    console.log('   - Now includes: draft, open, closed, active, archived');
  } catch (error: any) {
    // Check if error is because enum values already exist
    if (error.code === '42710') {
      console.log('⚠️  Enum values already exist - migration may have been applied previously');
      console.log('✅ Database is up to date');
    } else {
      console.error('❌ Migration failed:', error.message);
      throw error;
    }
  } finally {
    await pool.end();
  }
}

applyMigration().catch((error) => {
  console.error('Failed to apply migration:', error);
  process.exit(1);
});
