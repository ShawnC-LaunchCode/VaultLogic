import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function checkAllTestSchemas() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });

  try {
    await client.connect();

    const res = await client.query(
      "SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'test_schema_%' ORDER BY schema_name"
    );

    console.log(`Total test schemas: ${res.rows.length}\n`);

    let emptyCount = 0;
    let populatedCount = 0;

    for (const row of res.rows) {
      const tables = await client.query(
        'SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema = $1 AND table_type = \'BASE TABLE\'',
        [row.schema_name]
      );

      const tableCount = parseInt(tables.rows[0].cnt);
      if (tableCount === 0) {
        emptyCount++;
      } else {
        populatedCount++;
        console.log(`  ${row.schema_name}: ${tableCount} tables`);
      }
    }

    console.log(`\nSummary:`);
    console.log(`  Empty schemas: ${emptyCount}`);
    console.log(`  Populated schemas: ${populatedCount}`);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

checkAllTestSchemas();
