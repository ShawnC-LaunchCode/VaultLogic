import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const client = neon(process.env.DATABASE_URL!);
  const projectId = 'f9a95047-1fc3-4b62-9723-7542e4f2abfd';
  const correctTenantId = '15f19932-cda8-4294-a8e2-851fe4a1a2ad';

  console.log('=== Fixing Tenant Mismatch ===\n');
  console.log(`Project ID: ${projectId}`);
  console.log(`Correct Tenant ID: ${correctTenantId}\n`);

  // Get current project info
  const projects = await client`
    SELECT id, name, tenant_id, owner_id
    FROM projects
    WHERE id = ${projectId}
  `;

  if (projects.length === 0) {
    console.log('❌ Project not found');
    return;
  }

  const project = projects[0];
  console.log('Current Project Info:');
  console.log(project);
  console.log('');

  // Update project tenant
  console.log('🔧 Updating project tenant...');
  await client`
    UPDATE projects
    SET tenant_id = ${correctTenantId}
    WHERE id = ${projectId}
  `;
  console.log('✅ Project tenant updated!\n');

  // Verify the fix
  const updated = await client`
    SELECT id, name, tenant_id, owner_id
    FROM projects
    WHERE id = ${projectId}
  `;

  console.log('Updated Project Info:');
  console.log(updated[0]);
  console.log('');
  console.log('✅ Tenant mismatch fixed! You should now have access to the workflow.');
}

main().catch(console.error).finally(() => process.exit(0));
