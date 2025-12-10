import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const client = neon(process.env.DATABASE_URL!);
  const workflowId = '111c7d31-bef1-4b9d-909e-0113cbb481fb';

  const result = await client`
    SELECT id, title, owner_id, creator_id, project_id
    FROM workflows
    WHERE id = ${workflowId}
  `;

  console.log('Workflow details:');
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);
