import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const client = neon(process.env.DATABASE_URL!);
  const userId = '116568744155653496130';
  const correctTenantId = '15f19932-cda8-4294-a8e2-851fe4a1a2ad';

  console.log('=== Checking All Workflows for Tenant Mismatches ===\n');
  console.log(`User ID: ${userId}`);
  console.log(`User's Tenant: ${correctTenantId}\n`);

  // Get all workflows owned by this user
  const workflows = await client`
    SELECT
      w.id,
      w.title,
      w.project_id,
      p.name as project_name,
      p.tenant_id as project_tenant_id,
      p.owner_id as project_owner_id
    FROM workflows w
    LEFT JOIN projects p ON w.project_id = p.id
    WHERE w.owner_id = ${userId}
  `;

  console.log(`Found ${workflows.length} workflows owned by this user:\n`);

  const mismatches = [];

  for (const workflow of workflows) {
    const hasMismatch = workflow.project_tenant_id && workflow.project_tenant_id !== correctTenantId;

    console.log(`📋 Workflow: ${workflow.title}`);
    console.log(`   ID: ${workflow.id}`);
    console.log(`   Project: ${workflow.project_name || 'No project'}`);
    console.log(`   Project Tenant: ${workflow.project_tenant_id || 'N/A'}`);
    console.log(`   Status: ${hasMismatch ? '❌ MISMATCH' : '✅ OK'}`);
    console.log('');

    if (hasMismatch) {
      mismatches.push(workflow);
    }
  }

  if (mismatches.length === 0) {
    console.log('✅ No tenant mismatches found!');
    return;
  }

  console.log(`\n⚠️  Found ${mismatches.length} workflows with tenant mismatches\n`);
  console.log('🔧 Fixing projects...\n');

  // Get unique project IDs that need fixing
  const projectIds = [...new Set(mismatches.map(w => w.project_id).filter(Boolean))];

  for (const projectId of projectIds) {
    console.log(`Updating project: ${projectId}`);
    await client`
      UPDATE projects
      SET tenant_id = ${correctTenantId}
      WHERE id = ${projectId}
    `;
    console.log('  ✅ Updated');
  }

  console.log('\n✅ All tenant mismatches fixed!\n');
  console.log('🔄 Please refresh your browser to see the changes.');
}

main().catch(console.error).finally(() => process.exit(0));
