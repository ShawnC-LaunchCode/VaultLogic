import { config } from 'dotenv';
import { Client } from 'pg';

config();

const client = new Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();

  // Check columns in test_schema_w0.audit_logs
  await client.query("SET search_path TO test_schema_w0, public");

  const res = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'test_schema_w0'
    AND table_name = 'audit_logs'
    ORDER BY ordinal_position
  `);

  console.log(`Columns in test_schema_w0.audit_logs:`);
  res.rows.forEach(r => console.log(`  - ${r.column_name} (${r.data_type}, nullable: ${r.is_nullable})`));
} catch (error) {
  console.error('Error:', error);
  process.exit(1);
} finally {
  await client.end();
}
