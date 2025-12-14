import { BaseRepository, type DbTransaction } from "./BaseRepository";
import { workflowRuns, type WorkflowRun, type InsertWorkflowRun } from "@shared/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { db } from "../db";

/**
 * Repository for workflow run data access
 */
export class WorkflowRunRepository extends BaseRepository<
  typeof workflowRuns,
  WorkflowRun,
  InsertWorkflowRun
> {
  constructor(dbInstance?: typeof db) {
    super(workflowRuns, dbInstance);
  }

  /**
   * Find runs by workflow ID
   */
  async findByWorkflowId(workflowId: string, tx?: DbTransaction): Promise<WorkflowRun[]> {
    const database = this.getDb(tx);
    return await database
      .select()
      .from(workflowRuns)
      .where(eq(workflowRuns.workflowId, workflowId))
      .orderBy(desc(workflowRuns.createdAt));
  }

  /**
   * Find runs by multiple workflow IDs
   */
  async findByWorkflowIds(workflowIds: string[], tx?: DbTransaction): Promise<WorkflowRun[]> {
    const database = this.getDb(tx);
    if (workflowIds.length === 0) {
      return [];
    }
    return await database
      .select()
      .from(workflowRuns)
      .where(inArray(workflowRuns.workflowId, workflowIds))
      .orderBy(desc(workflowRuns.createdAt));
  }

  /**
   * Find completed runs by workflow ID
   */
  async findCompletedByWorkflowId(workflowId: string, tx?: DbTransaction): Promise<WorkflowRun[]> {
    const database = this.getDb(tx);
    return await database
      .select()
      .from(workflowRuns)
      .where(and(eq(workflowRuns.workflowId, workflowId), eq(workflowRuns.completed, true)))
      .orderBy(desc(workflowRuns.completedAt));
  }

  /**
   * Find run by token (for intake portal)
   */
  async findByToken(token: string, tx?: DbTransaction): Promise<WorkflowRun | null> {
    const database = this.getDb(tx);
    const [run] = await database
      .select()
      .from(workflowRuns)
      .where(eq(workflowRuns.runToken, token))
      .limit(1);
    return run || null;
  }

  /**
   * Find run by share token (read-only link)
   */
  async findByShareToken(token: string, tx?: DbTransaction): Promise<WorkflowRun | null> {
    const database = this.getDb(tx);
    const [run] = await database
      .select()
      .from(workflowRuns)
      .where(eq(workflowRuns.shareToken, token))
      .limit(1);
    return run || null;
  }

  /**
   * Mark run as complete
   */
  async markComplete(runId: string, tx?: DbTransaction): Promise<WorkflowRun> {
    const database = this.getDb(tx);
    const [updated] = await database
      .update(workflowRuns)
      .set({
        completed: true,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(workflowRuns.id, runId))
      .returning();
    return updated;
  }

  /**
   * Find run by portal access key
   */
  async findByPortalAccessKey(key: string, tx?: DbTransaction): Promise<WorkflowRun | null> {
    const database = this.getDb(tx);
    const [run] = await database
      .select()
      .from(workflowRuns)
      .where(eq(workflowRuns.portalAccessKey, key))
      .limit(1);
    return run || null;
  }
}

// Singleton instance
export const workflowRunRepository = new WorkflowRunRepository();
