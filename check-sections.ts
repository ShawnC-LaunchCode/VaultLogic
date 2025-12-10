import { initializeDatabase } from './server/db';
import { workflowService } from './server/services/WorkflowService';

const workflowId = 'd1077ee5-105f-40c7-b5b6-3fa41ffb013e';
const userId = '116568744155653496130'; // From logs

async function checkSections() {
  await initializeDatabase();

  console.log('Testing WorkflowService.getWorkflowWithDetails');
  console.log('Workflow ID:', workflowId);
  console.log('User ID:', userId);

  try {
    const result = await workflowService.getWorkflowWithDetails(workflowId, userId);

    console.log('\n=== RESULT ===');
    console.log('Workflow ID:', result.id);
    console.log('Workflow Title:', result.title);
    console.log('Sections Count:', result.sections?.length || 0);
    console.log('Logic Rules Count:', result.logicRules?.length || 0);

    if (result.sections && result.sections.length > 0) {
      console.log('\n=== SECTIONS ===');
      result.sections.forEach((section: any) => {
        console.log(`  - ${section.id}: ${section.title} (order: ${section.order})`);
        console.log(`    Steps: ${section.steps?.length || 0}`);
        section.steps?.forEach((step: any) => {
          console.log(`      - ${step.title} (${step.type})`);
        });
      });
    } else {
      console.log('\n!!! NO SECTIONS RETURNED !!!');
    }
  } catch (error) {
    console.error('\n!!! ERROR !!!');
    console.error(error);
  }

  process.exit(0);
}

checkSections().catch(console.error);
