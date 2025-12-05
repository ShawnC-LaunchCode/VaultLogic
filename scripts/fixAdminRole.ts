import dotenv from "dotenv";
dotenv.config();

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

async function fixAdminRole() {
  neonConfig.webSocketConstructor = ws.default as any;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  const userId = '116568744155653496130';

  console.log("🔍 Checking current user role...\n");

  const current = await client.query(
    'SELECT id, email, role, tenant_role, tenant_id FROM users WHERE id = $1',
    [userId]
  );

  console.log("Current user data:");
  console.log(current.rows[0]);
  console.log("");

  console.log("🔧 Updating to admin role...");

  await client.query(
    'UPDATE users SET role = $1, tenant_role = $2, updated_at = NOW() WHERE id = $3',
    ['admin', 'owner', userId]
  );

  console.log("✅ Updated!\n");

  const verify = await client.query(
    'SELECT id, email, role, tenant_role, tenant_id FROM users WHERE id = $1',
    [userId]
  );

  console.log("Verified user data:");
  console.log(verify.rows[0]);
  console.log("\n🎉 User is now admin! Please log out and log back in to refresh your session.");

  client.release();
  process.exit(0);
}

fixAdminRole();
