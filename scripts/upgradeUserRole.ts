import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const client = neon(process.env.DATABASE_URL!);
  const userId = '116568744155653496130';
  const newRole = 'owner'; // Give full access

  console.log('=== Upgrading User Role ===\n');
  console.log(`User ID: ${userId}`);
  console.log(`New Role: ${newRole}\n`);

  // Get current user info
  const users = await client`
    SELECT id, email, tenant_role, tenant_id
    FROM users
    WHERE id = ${userId}
  `;

  if (users.length === 0) {
    console.log('❌ User not found');
    return;
  }

  const user = users[0];
  console.log('Current User Info:');
  console.log(`  Email: ${user.email}`);
  console.log(`  Current Role: ${user.tenant_role}`);
  console.log(`  Tenant: ${user.tenant_id}\n`);

  // Update user role
  console.log('🔧 Updating user role...');
  await client`
    UPDATE users
    SET tenant_role = ${newRole}
    WHERE id = ${userId}
  `;
  console.log('✅ User role updated!\n');

  // Verify the update
  const updated = await client`
    SELECT id, email, tenant_role
    FROM users
    WHERE id = ${userId}
  `;

  console.log('Updated User Info:');
  console.log(`  Email: ${updated[0].email}`);
  console.log(`  New Role: ${updated[0].tenant_role}\n`);

  console.log('✅ Role upgrade complete!\n');
  console.log('Role Permissions:');
  console.log('  owner: All permissions (*)');
  console.log('    - Create, edit, delete workflows');
  console.log('    - Create, edit, delete templates');
  console.log('    - Manage projects and teams');
  console.log('    - Full system access\n');
  console.log('🔄 Please log out and log back in (or hard refresh) for changes to take effect.');
}

main().catch(console.error).finally(() => process.exit(0));
