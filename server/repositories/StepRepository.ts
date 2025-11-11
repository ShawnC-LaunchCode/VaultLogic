import { BaseRepository, type DbTransaction } from "./BaseRepository";
import { steps, type Step, type InsertStep } from "@shared/schema";
import { eq, asc, inArray, and } from "drizzle-orm";
import { db } from "../db";

/**
 * Repository for step data access
 */
export class StepRepository extends BaseRepository<typeof steps, Step, InsertStep> {
  constructor(dbInstance?: typeof db) {
    super(steps, dbInstance);
  }

  /**
   * Find steps by section ID (ordered by order field)
   * By default, excludes virtual steps (computed steps from transform blocks)
   * Set includeVirtual=true to include virtual steps
   */
  async findBySectionId(
    sectionId: string,
    tx?: DbTransaction,
    includeVirtual = false
  ): Promise<Step[]> {
    const database = this.getDb(tx);

    const conditions = [eq(steps.sectionId, sectionId)];
    if (!includeVirtual) {
      conditions.push(eq(steps.isVirtual, false));
    }

    return await database
      .select()
      .from(steps)
      .where(and(...conditions))
      .orderBy(asc(steps.order));
  }

  /**
   * Find steps by multiple section IDs
   * By default, excludes virtual steps (computed steps from transform blocks)
   * Set includeVirtual=true to include virtual steps
   */
  async findBySectionIds(
    sectionIds: string[],
    tx?: DbTransaction,
    includeVirtual = false
  ): Promise<Step[]> {
    const database = this.getDb(tx);
    if (sectionIds.length === 0) return [];

    const conditions = [inArray(steps.sectionId, sectionIds)];
    if (!includeVirtual) {
      conditions.push(eq(steps.isVirtual, false));
    }

    return await database
      .select()
      .from(steps)
      .where(and(...conditions))
      .orderBy(asc(steps.order));
  }

  /**
   * Find a step by ID and verify it belongs to the section
   */
  async findByIdAndSection(
    stepId: string,
    sectionId: string,
    tx?: DbTransaction
  ): Promise<Step | undefined> {
    const database = this.getDb(tx);
    const [step] = await database
      .select()
      .from(steps)
      .where(eq(steps.id, stepId));

    if (step && step.sectionId === sectionId) {
      return step;
    }
    return undefined;
  }

  /**
   * Update step order
   */
  async updateOrder(stepId: string, order: number, tx?: DbTransaction): Promise<Step> {
    const database = this.getDb(tx);
    const [updated] = await database
      .update(steps)
      .set({ order })
      .where(eq(steps.id, stepId))
      .returning();
    return updated;
  }
}

// Singleton instance
export const stepRepository = new StepRepository();
