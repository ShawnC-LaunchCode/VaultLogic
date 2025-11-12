import type { EvalContext } from './expr';
import {
  executeQuestionNode,
  type QuestionNodeConfig,
  type QuestionNodeInput,
  type QuestionNodeOutput,
} from './nodes/question';
import {
  executeComputeNode,
  type ComputeNodeConfig,
  type ComputeNodeInput,
  type ComputeNodeOutput,
} from './nodes/compute';
import {
  executeBranchNode,
  type BranchNodeConfig,
  type BranchNodeInput,
  type BranchNodeOutput,
} from './nodes/branch';
import {
  executeTemplateNode,
  type TemplateNodeConfig,
  type TemplateNodeInput,
  type TemplateNodeOutput,
} from './nodes/template';
import {
  executeHttpNode,
  type HttpNodeConfig,
  type HttpNodeInput,
  type HttpNodeOutput,
} from './nodes/http';

/**
 * Node Executor Registry
 * Central registry for all node type executors
 */

export type NodeType = 'question' | 'compute' | 'branch' | 'template' | 'http';

export type NodeConfig =
  | QuestionNodeConfig
  | ComputeNodeConfig
  | BranchNodeConfig
  | TemplateNodeConfig
  | HttpNodeConfig;

export type NodeOutput =
  | QuestionNodeOutput
  | ComputeNodeOutput
  | BranchNodeOutput
  | TemplateNodeOutput
  | HttpNodeOutput;

export interface Node {
  id: string;
  type: NodeType;
  config: NodeConfig;
}

export interface ExecuteNodeInput {
  node: Node;
  context: EvalContext;
  tenantId: string;
  projectId?: string; // For HTTP nodes (secret/connection resolution)
  userInputs?: Record<string, any>; // For question nodes
}

/**
 * Execute a node based on its type
 *
 * @param input - Node execution input
 * @returns Node execution output
 */
export async function executeNode(input: ExecuteNodeInput): Promise<NodeOutput> {
  const { node, context, tenantId, userInputs } = input;

  switch (node.type) {
    case 'question': {
      const questionInput: QuestionNodeInput = {
        nodeId: node.id,
        config: node.config as QuestionNodeConfig,
        context,
        userAnswer: userInputs?.[node.id],
      };
      return await executeQuestionNode(questionInput);
    }

    case 'compute': {
      const computeInput: ComputeNodeInput = {
        nodeId: node.id,
        config: node.config as ComputeNodeConfig,
        context,
      };
      return await executeComputeNode(computeInput);
    }

    case 'branch': {
      const branchInput: BranchNodeInput = {
        nodeId: node.id,
        config: node.config as BranchNodeConfig,
        context,
      };
      return await executeBranchNode(branchInput);
    }

    case 'template': {
      const templateInput: TemplateNodeInput = {
        nodeId: node.id,
        config: node.config as TemplateNodeConfig,
        context,
        tenantId,
      };
      return await executeTemplateNode(templateInput);
    }

    case 'http': {
      if (!projectId) {
        throw new Error('projectId is required for HTTP nodes');
      }
      const httpInput: HttpNodeInput = {
        nodeId: node.id,
        config: node.config as HttpNodeConfig,
        context,
        projectId,
      };
      return await executeHttpNode(httpInput);
    }

    default:
      throw new Error(`Unknown node type: ${(node as any).type}`);
  }
}

/**
 * Get all supported node types
 */
export function getSupportedNodeTypes(): NodeType[] {
  return ['question', 'compute', 'branch', 'template', 'http'];
}

/**
 * Check if a node type is supported
 */
export function isNodeTypeSupported(type: string): type is NodeType {
  return getSupportedNodeTypes().includes(type as NodeType);
}
