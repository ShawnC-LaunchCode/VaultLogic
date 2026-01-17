import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function checkTableLocation() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });

  try {
    await client.connect();
    console.log('Connected to database\n');

    // Check if audit_logs exists in public schema
    const publicCheck = await client.query(
      `SELECT table_schema, table_name FROM information_schema.tables WHERE table_name = 'audit_logs' AND table_schema = 'public'`
    );
    console.log(`audit_logs in public schema: ${publicCheck.rowCount > 0 ? 'YES' : 'NO'}`);

    if (publicCheck.rowCount > 0) {
      console.log('  Found in public schema!\n');

      // Get columns
      const cols = await client.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_logs' ORDER BY ordinal_position`
      );
      console.log('  Columns:', cols.rows.map(r => r.column_name).join(', '));
    }

    // Check any test schemas that have the audit_logs table
    const testSchemaCheck = await client.query(
      `SELECT table_schema FROM information_schema.tables WHERE table_name = 'audit_logs' AND table_schema LIKE 'test_schema_%'`
    );

    console.log(`\naudit_logs in test schemas: ${testSchemaCheck.rowCount} schemas`);
    if (testSchemaCheck.rowCount > 0) {
      testSchemaCheck.rows.forEach(row => {
        console.log(`  - ${row.table_schema}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

checkTableLocation();
