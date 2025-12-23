

import { db, dbInitPromise } from '../server/db';
import { workflows } from '../shared/schema';

async function listWorkflows() {
  await dbInitPromise;
  try {
    const existingWorkflows = await db.select().from(workflows).limit(1);
    console.log('Workflows:', existingWorkflows);
  } catch (error) {
    console.error('Error listing workflows:', error);
  }
}

listWorkflows();

