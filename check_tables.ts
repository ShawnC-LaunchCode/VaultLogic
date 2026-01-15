import { config } from 'dotenv';
import { Client } from 'pg';

config();

const client = new Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();

  // Check tables in test_schema_w0
  const res = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'test_schema_w0'
    AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  console.log(`Tables in test_schema_w0:`);
  res.rows.forEach(r => console.log(`  - ${r.table_name}`));

  // Now check if audit_logs exists specifically
  const auditCheck = await client.query(`
    SELECT COUNT(*) as cnt
    FROM information_schema.tables
    WHERE table_schema = 'test_schema_w0'
    AND table_name = 'audit_logs'
  `);

  console.log(`\naudit_logs exists: ${auditCheck.rows[0].cnt > 0}`);

  if (auditCheck.rows[0].cnt > 0) {
    const cols = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'test_schema_w0'
      AND table_name = 'audit_logs'
      ORDER BY ordinal_position
    `);
    console.log(`\nColumns in audit_logs:`);
    cols.rows.forEach(r => console.log(`  - ${r.column_name} (${r.data_type})`));
  }
} catch (error) {
  console.error('Error:', error);
  process.exit(1);
} finally {
  await client.end();
}
