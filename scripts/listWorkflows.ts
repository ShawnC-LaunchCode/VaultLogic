import dotenv from "dotenv";
dotenv.config();

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

async function listWorkflows() {
  neonConfig.webSocketConstructor = ws.default as any;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  const res = await client.query('SELECT id, title, status, public_link FROM workflows ORDER BY created_at DESC LIMIT 10');

  console.log(`Found ${res.rows.length} workflows:\n`);

  res.rows.forEach((w: any, i: number) => {
    console.log(`${i+1}. ${w.title}`);
    console.log(`   ID: ${w.id}`);
    console.log(`   Status: ${w.status}`);
    console.log(`   Builder: http://localhost:5000/workflows/${w.id}`);
    if (w.public_link) console.log(`   Public Run: http://localhost:5000/run/${w.public_link}`);
    console.log('');
  });

  client.release();
  process.exit(0);
}

listWorkflows();
