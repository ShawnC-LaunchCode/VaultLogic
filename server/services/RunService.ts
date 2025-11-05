import {
  workflowRunRepository,
  stepValueRepository,
  workflowRepository,
  sectionRepository,
  stepRepository,
  logicRuleRepository,
} from "../repositories";
import type { WorkflowRun, InsertWorkflowRun, InsertStepValue } from "@shared/schema";
import { workflowService } from "./WorkflowService";
import { transformBlockService } from "./TransformBlockService";
import { evaluateRules, validateRequiredSteps, getEffectiveRequiredSteps } from "@shared/workflowLogic";

/**
 * Service layer for workflow run-related business logic
 */
export class RunService {
  private runRepo: typeof workflowRunRepository;
  private valueRepo: typeof stepValueRepository;
  private workflowRepo: typeof workflowRepository;
  private sectionRepo: typeof sectionRepository;
  private stepRepo: typeof stepRepository;
  private logicRuleRepo: typeof logicRuleRepository;
  private workflowSvc: typeof workflowService;
  private transformSvc: typeof transformBlockService;

  constructor(
    runRepo?: typeof workflowRunRepository,
    valueRepo?: typeof stepValueRepository,
    workflowRepo?: typeof workflowRepository,
    sectionRepo?: typeof sectionRepository,
    stepRepo?: typeof stepRepository,
    logicRuleRepo?: typeof logicRuleRepository,
    workflowSvc?: typeof workflowService,
    transformSvc?: typeof transformBlockService
  ) {
    this.runRepo = runRepo || workflowRunRepository;
    this.valueRepo = valueRepo || stepValueRepository;
    this.workflowRepo = workflowRepo || workflowRepository;
    this.sectionRepo = sectionRepo || sectionRepository;
    this.stepRepo = stepRepo || stepRepository;
    this.logicRuleRepo = logicRuleRepo || logicRuleRepository;
    this.workflowSvc = workflowSvc || workflowService;
    this.transformSvc = transformSvc || transformBlockService;
  }

  /**
   * Create a new workflow run
   */
  async createRun(
    workflowId: string,
    userId: string,
    data: Omit<InsertWorkflowRun, 'workflowId'>
  ): Promise<WorkflowRun> {
    await this.workflowSvc.verifyOwnership(workflowId, userId);

    return await this.runRepo.create({
      ...data,
      workflowId,
      completed: false,
    });
  }

  /**
   * Get run by ID
   */
  async getRun(runId: string, userId: string): Promise<WorkflowRun> {
    const run = await this.runRepo.findById(runId);
    if (!run) {
      throw new Error("Run not found");
    }

    // Verify ownership of the workflow
    await this.workflowSvc.verifyOwnership(run.workflowId, userId);

    return run;
  }

  /**
   * Get run with all values
   */
  async getRunWithValues(runId: string, userId: string) {
    const run = await this.getRun(runId, userId);
    const values = await this.valueRepo.findByRunId(runId);

    return {
      ...run,
      values,
    };
  }

  /**
   * Upsert a step value
   */
  async upsertStepValue(
    runId: string,
    userId: string,
    data: InsertStepValue
  ): Promise<void> {
    const run = await this.getRun(runId, userId);

    // Verify step belongs to the workflow
    const step = await this.stepRepo.findById(data.stepId);
    if (!step) {
      throw new Error("Step not found");
    }

    const section = await this.sectionRepo.findById(step.sectionId);
    if (!section || section.workflowId !== run.workflowId) {
      throw new Error("Step does not belong to this workflow");
    }

    await this.valueRepo.upsert(data);
  }

  /**
   * Bulk upsert step values
   */
  async bulkUpsertValues(
    runId: string,
    userId: string,
    values: Array<{ stepId: string; value: any }>
  ): Promise<void> {
    const run = await this.getRun(runId, userId);

    for (const { stepId, value } of values) {
      await this.upsertStepValue(runId, userId, {
        runId,
        stepId,
        value,
      });
    }
  }

  /**
   * Complete a workflow run (with validation)
   */
  async completeRun(runId: string, userId: string): Promise<WorkflowRun> {
    const run = await this.getRun(runId, userId);

    if (run.completed) {
      throw new Error("Run is already completed");
    }

    // Get all workflow data
    const workflow = await this.workflowRepo.findById(run.workflowId);
    if (!workflow) {
      throw new Error("Workflow not found");
    }

    const sections = await this.sectionRepo.findByWorkflowId(workflow.id);
    const sectionIds = sections.map((s) => s.id);
    const steps = await this.stepRepo.findBySectionIds(sectionIds);
    const logicRules = await this.logicRuleRepo.findByWorkflowId(workflow.id);
    const currentValues = await this.valueRepo.findByRunId(runId);

    // Build data object for evaluation
    const data: Record<string, any> = {};
    currentValues.forEach((v) => {
      data[v.stepId] = v.value;
    });

    // ===================================================================
    // Execute transform blocks BEFORE validation
    // This allows transform blocks to compute derived values that may be
    // required for validation or subsequent logic
    // ===================================================================
    const transformResult = await this.transformSvc.executeAllForWorkflow({
      workflowId: workflow.id,
      runId,
      data,
    });

    // Use updated data from transform blocks (includes computed outputs)
    const finalData = transformResult.data || data;

    // If transform blocks had errors, log them but continue
    // (transform errors don't prevent run completion unless critical)
    if (transformResult.errors && transformResult.errors.length > 0) {
      console.warn(`Transform block errors during run ${runId}:`, transformResult.errors);
    }

    // Get initially required steps
    const initialRequiredSteps = new Set(steps.filter((s) => s.required).map((s) => s.id));

    // Evaluate logic to get effective required steps
    const effectiveRequiredSteps = getEffectiveRequiredSteps(
      initialRequiredSteps,
      logicRules,
      finalData
    );

    // Validate all required steps have values
    const validation = validateRequiredSteps(effectiveRequiredSteps, finalData);

    if (!validation.valid) {
      throw new Error(`Missing required steps: ${validation.missingSteps.join(', ')}`);
    }

    // Mark run as complete
    return await this.runRepo.markComplete(runId);
  }

  /**
   * List runs for a workflow
   */
  async listRuns(workflowId: string, userId: string): Promise<WorkflowRun[]> {
    await this.workflowSvc.verifyOwnership(workflowId, userId);
    return await this.runRepo.findByWorkflowId(workflowId);
  }
}

// Singleton instance
export const runService = new RunService();
