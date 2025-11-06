import type { WorkflowVariable } from "@shared/schema";

/**
 * VariableResolver - Resolves aliases to canonical step keys
 *
 * This utility helps normalize operand references in logic rules and block configs.
 * It supports both alias and key references, always returning the canonical key.
 */
export class VariableResolver {
  /**
   * Resolve an operand (which may be an alias or a key) to its canonical key
   *
   * @param operand - The operand to resolve (can be alias or key)
   * @param variables - Array of workflow variables
   * @returns The canonical step key (ID)
   */
  static resolveOperand(operand: string, variables: WorkflowVariable[]): string {
    if (!operand) {
      return operand;
    }

    // First, check if operand matches an alias
    const byAlias = variables.find(v => v.alias === operand);
    if (byAlias) {
      return byAlias.key;
    }

    // Otherwise, assume it's already a key (or invalid - let validation catch it)
    return operand;
  }

  /**
   * Resolve multiple operands at once
   *
   * @param operands - Array of operands to resolve
   * @param variables - Array of workflow variables
   * @returns Array of resolved keys
   */
  static resolveOperands(operands: string[], variables: WorkflowVariable[]): string[] {
    return operands.map(op => this.resolveOperand(op, variables));
  }

  /**
   * Get variable by key or alias
   *
   * @param keyOrAlias - Key or alias to search for
   * @param variables - Array of workflow variables
   * @returns The matching variable or undefined
   */
  static getVariable(keyOrAlias: string, variables: WorkflowVariable[]): WorkflowVariable | undefined {
    // Try by key first (most common case)
    const byKey = variables.find(v => v.key === keyOrAlias);
    if (byKey) {
      return byKey;
    }

    // Try by alias
    return variables.find(v => v.alias === keyOrAlias);
  }

  /**
   * Validate that an operand resolves to a valid variable
   *
   * @param operand - The operand to validate
   * @param variables - Array of workflow variables
   * @returns True if operand resolves to a valid variable
   */
  static isValidOperand(operand: string, variables: WorkflowVariable[]): boolean {
    const resolved = this.resolveOperand(operand, variables);
    return variables.some(v => v.key === resolved);
  }
}

// Export a default instance for convenience
export const variableResolver = VariableResolver;
