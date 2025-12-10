import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const client = neon(process.env.DATABASE_URL!);

  // Get a default project
  const projects = await client`SELECT id, name FROM projects WHERE archived = false LIMIT 1`;

  if (projects.length === 0) {
    console.log('❌ No projects found. Creating a default project...');

    // Get first user
    const users = await client`SELECT id FROM users LIMIT 1`;
    const userId = users[0]?.id || 'system';

    // Get or create tenant
    let tenant = await client`SELECT id FROM tenants LIMIT 1`;
    if (tenant.length === 0) {
      tenant = await client`INSERT INTO tenants (name, plan) VALUES ('Default Organization', 'free') RETURNING id`;
    }
    const tenantId = tenant[0].id;

    // Create default project
    const newProjects = await client`
      INSERT INTO projects (name, tenant_id, created_by, owner_id, archived)
      VALUES ('Default Project', ${tenantId}, ${userId}, ${userId}, false)
      RETURNING id, name
    `;

    console.log(`✅ Created default project: ${newProjects[0].name} (${newProjects[0].id})`);
    const defaultProjectId = newProjects[0].id;

    // Assign all workflows without project to default project
    await client`UPDATE workflows SET project_id = ${defaultProjectId} WHERE project_id IS NULL`;

    console.log('✅ Assigned all workflows without project to default project');
  } else {
    const defaultProject = projects[0];
    console.log(`✅ Using existing project: ${defaultProject.name} (${defaultProject.id})`);

    // Assign all workflows without project to this project
    const result = await client`
      UPDATE workflows
      SET project_id = ${defaultProject.id}
      WHERE project_id IS NULL
    `;

    console.log(`✅ Updated ${result.length} workflows`);
  }

  // Verify
  const workflowsWithoutProject = await client`SELECT COUNT(*) as count FROM workflows WHERE project_id IS NULL`;
  console.log(`\n📊 Workflows without project: ${workflowsWithoutProject[0].count}`);
}

main().catch(console.error);
