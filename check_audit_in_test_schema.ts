import { config } from 'dotenv';
import { Client } from 'pg';

config();

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function checkAuditLogs() {
  try {
    await client.connect();

    // Check multiple test schemas
    const schemas = ['test_schema_w0', 'test_schema_w1', 'test_schema_w2'];

    for (const schema of schemas) {
      console.log(`\n========== ${schema} ==========`);

      // Check if audit_logs table exists
      const tableCheck = await client.query(`
        SELECT COUNT(*) as cnt
        FROM information_schema.tables
        WHERE table_schema = $1 AND table_name = 'audit_logs'
      `, [schema]);

      console.log(`audit_logs table exists: ${tableCheck.rows[0].cnt > 0}`);

      if (tableCheck.rows[0].cnt > 0) {
        // Check columns
        const cols = await client.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_schema = $1 AND table_name = 'audit_logs'
          ORDER BY ordinal_position
        `, [schema]);

        console.log(`\nColumns (${cols.rows.length}):`);
        cols.rows.forEach(r => {
          console.log(`  ${r.column_name.padEnd(20)} ${r.data_type.padEnd(20)} nullable: ${r.is_nullable}`);
        });
      }

      // Check total table count
      const allTables = await client.query(`
        SELECT COUNT(*) as cnt
        FROM information_schema.tables
        WHERE table_schema = $1 AND table_type = 'BASE TABLE'
      `, [schema]);

      console.log(`\nTotal tables in schema: ${allTables.rows[0].cnt}`);
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

checkAuditLogs();
