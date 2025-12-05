import dotenv from "dotenv";
dotenv.config();

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

async function updateUserToOwner() {
  neonConfig.webSocketConstructor = ws.default as any;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  const userId = '116568744155653496130';

  console.log("🔧 UPDATING USER TO OWNER\n");

  const result = await client.query(`
    UPDATE users
    SET
      tenant_role = $1,
      auth_provider = $2,
      updated_at = NOW()
    WHERE id = $3
    RETURNING *
  `, ['owner', 'google', userId]);

  if (result.rows.length > 0) {
    const user = result.rows[0];
    console.log("✅ User updated successfully:");
    console.log(`  ID: ${user.id}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Tenant Role: ${user.tenant_role}`);
    console.log(`  Auth Provider: ${user.auth_provider}`);
    console.log(`  Updated: ${user.updated_at}`);
  } else {
    console.log("❌ User not found!");
  }

  client.release();
  process.exit(0);
}

updateUserToOwner();
