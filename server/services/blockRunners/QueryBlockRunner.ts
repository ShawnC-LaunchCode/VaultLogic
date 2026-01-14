/**
 * Query Block Runner
 * Fetches data using the Query Runner
 */

import { queryRunner } from "../../lib/queries/QueryRunner";
import { logger } from "../../logger";
import { workflowQueriesRepository, stepValueRepository } from "../../repositories";

import { BaseBlockRunner } from "./BaseBlockRunner";

import type { BlockContext, BlockResult, Block, QueryBlockConfig } from "./types";

export class QueryBlockRunner extends BaseBlockRunner {
  getBlockType(): string {
    return "query";
  }

  async execute(config: QueryBlockConfig, context: BlockContext, block: Block): Promise<BlockResult> {
    try {
      // Get query definition
      const query = await workflowQueriesRepository.findById(config.queryId);
      if (!query) {
        return {
          success: false,
          errors: [`Query definition not found: ${config.queryId}`],
        };
      }

      logger.info({
        workflowId: context.workflowId,
        queryId: config.queryId,
        outputVar: config.outputVariableName
      }, "Executing query block");

      // Get tenantId from workflow
      const tenantId = await this.getTenantIdFromWorkflow(context.workflowId);
      if (!tenantId) {
        return {
          success: false,
          errors: ["Failed to resolve tenantId from workflow"],
        };
      }

      // Execute query with current context data
      const listVariable = await queryRunner.executeQuery(query, context.data, tenantId);

      // Persist to virtual step if runId is present
      if (context.runId && block.virtualStepId) {
        try {
          await stepValueRepository.upsert({
            runId: context.runId,
            stepId: block.virtualStepId,
            value: listVariable,
          });
          logger.debug({
            blockId: block.id,
            virtualStepId: block.virtualStepId,
            rowCount: listVariable.rowCount
          }, "Persisted query block output");
        } catch (error) {
          logger.error({ error, blockId: block.id }, "Failed to persist query block output");
        }
      }

      return {
        success: true,
        data: {
          [config.outputVariableName]: listVariable
        }
      };
    } catch (error) {
      logger.error({ error, blockConfig: config }, "Error executing query block");
      return {
        success: false,
        errors: [`Query execution failed: ${error instanceof Error ? error.message : 'unknown error'}`],
      };
    }
  }

  /**
   * Helper: Get tenantId from workflowId
   */
  private async getTenantIdFromWorkflow(workflowId: string): Promise<string | null> {
    try {
      const { workflowRepository } = await import("../../repositories");
      const workflow = await workflowRepository.findById(workflowId);

      if (!workflow) {
        logger.warn({ workflowId }, "Workflow not found");
        return null;
      }

      // 1. Try Project linkage
      if (workflow.projectId) {
        const { projectRepository } = await import("../../repositories");
        const project = await projectRepository.findById(workflow.projectId);
        if (project) {
          return project.tenantId;
        }
        logger.warn(
          { projectId: workflow.projectId, workflowId },
          "Project not found for workflow, falling back to creator"
        );
      }

      // 2. Fallback: Creator's Tenant
      if (workflow.creatorId) {
        const { userRepository } = await import("../../repositories");
        const creator = await userRepository.findById(workflow.creatorId);

        if (creator?.tenantId) {
          return creator.tenantId;
        }
      }



      logger.warn(
        { workflowId, creatorId: workflow.creatorId },
        "Could not resolve tenantId from project or creator"
      );
      return null;
    } catch (error) {
      logger.error({ error, workflowId }, "Error fetching tenantId from workflow");
      return null;
    }
  }
}
