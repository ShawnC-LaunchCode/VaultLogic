import { config } from 'dotenv';
import { Client } from 'pg';

config();

const client = new Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  const res = await client.query(
    "SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'test_schema_%' ORDER BY schema_name"
  );
  console.log(`Found ${res.rows.length} test schemas:`);
  res.rows.forEach(r => console.log(`  - ${r.schema_name}`));
} catch (error) {
  console.error('Error:', error);
  process.exit(1);
} finally {
  await client.end();
}
