/**
 * Stage 21: Template Node Unit Tests
 *
 * Tests for multi-template node execution
 * NOTE: These are integration tests that require database connectivity
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { describeWithDb } from '../../helpers/dbTestHelper';
import { db } from '../../../server/db';
import {
  projects,
  workflows,
  workflowVersions,
  templates,
  workflowTemplates,
  runs,
  runOutputs,
} from '../../../shared/schema';
import { executeTemplateNode } from '../../../server/engine/nodes/template';
import type { TemplateNodeConfig, TemplateNodeInput } from '../../../server/engine/nodes/template';
import { eq, and } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';

// Mock the docxRenderer2 module
vi.mock('../../../server/services/docxRenderer2', () => ({
  renderDocx2: vi.fn(async (options: any) => {
    return {
      docxPath: path.join(options.outputDir, 'test-output.docx'),
      pdfPath: options.toPdf ? path.join(options.outputDir, 'test-output.pdf') : undefined,
      size: 1024,
    };
  }),
  extractPlaceholders2: vi.fn(async () => ['name', 'email']),
  validateTemplateData2: vi.fn(() => ({ valid: true, missing: [], extra: [] })),
}));

// Mock template file operations
vi.mock('../../../server/services/templates', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    getTemplateFilePath: vi.fn((fileRef: string) => `/fake/path/${fileRef}`),
    getOutputFilePath: vi.fn((fileRef: string) => `/fake/outputs/${fileRef}`),
  };
});

// Mock fs operations
vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn(async () => {}),
    writeFile: vi.fn(async () => {}),
    unlink: vi.fn(async () => {}),
    access: vi.fn(async () => {}),
  },
}));

describeWithDb('Template Node - Multi-Template Support', () => {
  let testProjectId: string;
  let testWorkflowId: string;
  let testVersionId: string;
  let testTemplateId1: string;
  let testTemplateId2: string;
  let testTenantId: string;
  let testRunId: string;

  beforeEach(async () => {
    testTenantId = 'test-tenant-id';

    // Create test project
    const [project] = await db
      .insert(projects)
      .values({
        name: 'Test Project',
        description: 'Test project',
        tenantId: testTenantId,
      })
      .returning();
    testProjectId = project.id;

    // Create test workflow
    const [workflow] = await db
      .insert(workflows)
      .values({
        projectId: testProjectId,
        title: 'Test Workflow',
        description: 'Test workflow',
        status: 'draft',
      })
      .returning();
    testWorkflowId = workflow.id;

    // Create test workflow version
    const [version] = await db
      .insert(workflowVersions)
      .values({
        workflowId: testWorkflowId,
        version: '1.0.0',
        status: 'draft',
        changelog: 'Initial version',
      })
      .returning();
    testVersionId = version.id;

    // Create test templates
    const [template1] = await db
      .insert(templates)
      .values({
        projectId: testProjectId,
        name: 'Engagement Letter',
        description: 'Main engagement letter',
        type: 'docx',
        fileRef: 'template1.docx',
      })
      .returning();
    testTemplateId1 = template1.id;

    const [template2] = await db
      .insert(templates)
      .values({
        projectId: testProjectId,
        name: 'Schedule A',
        description: 'Schedule A annex',
        type: 'docx',
        fileRef: 'template2.docx',
      })
      .returning();
    testTemplateId2 = template2.id;

    // Create test run
    const [run] = await db
      .insert(runs)
      .values({
        workflowVersionId: testVersionId,
        status: 'in_progress',
      })
      .returning();
    testRunId = run.id;
  });

  afterEach(async () => {
    // Cleanup in reverse order of dependencies
    await db.delete(runOutputs).where(eq(runOutputs.runId, testRunId));
    await db.delete(runs).where(eq(runs.id, testRunId));
    await db.delete(workflowTemplates).where(eq(workflowTemplates.workflowVersionId, testVersionId));
    await db.delete(workflowVersions).where(eq(workflowVersions.id, testVersionId));
    await db.delete(workflows).where(eq(workflows.id, testWorkflowId));
    await db.delete(templates).where(eq(templates.projectId, testProjectId));
    await db.delete(projects).where(eq(projects.id, testProjectId));
  });

  describe('Template Key Resolution (New Path)', () => {
    it('should resolve template by key from workflowTemplates mapping', async () => {
      // Attach template to workflow version
      await db.insert(workflowTemplates).values({
        workflowVersionId: testVersionId,
        templateId: testTemplateId1,
        key: 'engagement_letter',
        isPrimary: true,
      });

      const config: TemplateNodeConfig = {
        templateKey: 'engagement_letter',
        bindings: {
          name: 'user.name',
          email: 'user.email',
        },
      };

      const input: TemplateNodeInput = {
        nodeId: 'node-1',
        config,
        context: {
          user: { name: 'John Doe', email: 'john@example.com' },
        },
        tenantId: testTenantId,
        runId: testRunId,
        workflowVersionId: testVersionId,
      };

      const result = await executeTemplateNode(input);

      expect(result.status).toBe('executed');
      expect(result.outputRef).toBeDefined();
      expect(result.bindings).toEqual({
        name: 'John Doe',
        email: 'john@example.com',
      });
    });

    it('should throw error if template key not found', async () => {
      const config: TemplateNodeConfig = {
        templateKey: 'nonexistent',
        bindings: {},
      };

      const input: TemplateNodeInput = {
        nodeId: 'node-1',
        config,
        context: {},
        tenantId: testTenantId,
        workflowVersionId: testVersionId,
      };

      const result = await executeTemplateNode(input);

      expect(result.status).toBe('executed');
      expect(result.error).toContain('not found');
    });

    it('should store output in runOutputs table', async () => {
      // Attach template
      await db.insert(workflowTemplates).values({
        workflowVersionId: testVersionId,
        templateId: testTemplateId1,
        key: 'engagement_letter',
        isPrimary: true,
      });

      const config: TemplateNodeConfig = {
        templateKey: 'engagement_letter',
        bindings: {
          name: 'user.name',
        },
      };

      const input: TemplateNodeInput = {
        nodeId: 'node-1',
        config,
        context: { user: { name: 'Jane' } },
        tenantId: testTenantId,
        runId: testRunId,
        workflowVersionId: testVersionId,
      };

      await executeTemplateNode(input);

      // Verify output was stored
      const outputs = await db
        .select()
        .from(runOutputs)
        .where(
          and(eq(runOutputs.runId, testRunId), eq(runOutputs.templateKey, 'engagement_letter'))
        );

      expect(outputs).toHaveLength(1);
      expect(outputs[0].status).toBe('ready');
      expect(outputs[0].fileType).toBe('docx');
      expect(outputs[0].storagePath).toContain('.docx');
    });
  });

  describe('Legacy Template ID Path (Backward Compatibility)', () => {
    it('should resolve template by templateId directly', async () => {
      const config: TemplateNodeConfig = {
        templateId: testTemplateId1,
        bindings: {
          name: 'user.name',
        },
      };

      const input: TemplateNodeInput = {
        nodeId: 'node-1',
        config,
        context: { user: { name: 'Alice' } },
        tenantId: testTenantId,
      };

      const result = await executeTemplateNode(input);

      expect(result.status).toBe('executed');
      expect(result.bindings).toEqual({ name: 'Alice' });
    });

    it('should throw error if templateId not found', async () => {
      const config: TemplateNodeConfig = {
        templateId: 'non-existent-id',
        bindings: {},
      };

      const input: TemplateNodeInput = {
        nodeId: 'node-1',
        config,
        context: {},
        tenantId: testTenantId,
      };

      const result = await executeTemplateNode(input);

      expect(result.status).toBe('executed');
      expect(result.error).toContain('not found');
    });
  });

  describe('Rendering Engine Selection', () => {
    it('should use docxRenderer2 by default (v2 engine)', async () => {
      await db.insert(workflowTemplates).values({
        workflowVersionId: testVersionId,
        templateId: testTemplateId1,
        key: 'engagement_letter',
        isPrimary: true,
      });

      const config: TemplateNodeConfig = {
        templateKey: 'engagement_letter',
        bindings: {},
      };

      const input: TemplateNodeInput = {
        nodeId: 'node-1',
        config,
        context: {},
        tenantId: testTenantId,
        workflowVersionId: testVersionId,
      };

      const result = await executeTemplateNode(input);

      expect(result.status).toBe('executed');
      // v2 engine should be used by default
    });

    it('should use legacy engine when engine="legacy"', async () => {
      const config: TemplateNodeConfig = {
        templateId: testTemplateId1,
        bindings: {},
        engine: 'legacy',
      };

      const input: TemplateNodeInput = {
        nodeId: 'node-1',
        config,
        context: {},
        tenantId: testTenantId,
      };

      const result = await executeTemplateNode(input);

      expect(result.status).toBe('executed');
    });
  });

  describe('PDF Generation', () => {
    it('should generate PDF when toPdf=true', async () => {
      await db.insert(workflowTemplates).values({
        workflowVersionId: testVersionId,
        templateId: testTemplateId1,
        key: 'engagement_letter',
        isPrimary: true,
      });

      const config: TemplateNodeConfig = {
        templateKey: 'engagement_letter',
        bindings: {},
        toPdf: true,
      };

      const input: TemplateNodeInput = {
        nodeId: 'node-1',
        config,
        context: {},
        tenantId: testTenantId,
        runId: testRunId,
        workflowVersionId: testVersionId,
      };

      const result = await executeTemplateNode(input);

      expect(result.status).toBe('executed');
      expect(result.outputRef?.pdfRef).toBeDefined();

      // Verify PDF output was stored
      const outputs = await db
        .select()
        .from(runOutputs)
        .where(eq(runOutputs.runId, testRunId));

      expect(outputs).toHaveLength(1);
      expect(outputs[0].fileType).toBe('pdf');
    });

    it('should default to DOCX when toPdf=false', async () => {
      await db.insert(workflowTemplates).values({
        workflowVersionId: testVersionId,
        templateId: testTemplateId1,
        key: 'engagement_letter',
        isPrimary: true,
      });

      const config: TemplateNodeConfig = {
        templateKey: 'engagement_letter',
        bindings: {},
        toPdf: false,
      };

      const input: TemplateNodeInput = {
        nodeId: 'node-1',
        config,
        context: {},
        tenantId: testTenantId,
        runId: testRunId,
        workflowVersionId: testVersionId,
      };

      const result = await executeTemplateNode(input);

      expect(result.status).toBe('executed');

      const outputs = await db
        .select()
        .from(runOutputs)
        .where(eq(runOutputs.runId, testRunId));

      expect(outputs).toHaveLength(1);
      expect(outputs[0].fileType).toBe('docx');
    });
  });

  describe('Conditional Execution', () => {
    it('should skip execution when condition evaluates to false', async () => {
      const config: TemplateNodeConfig = {
        templateId: testTemplateId1,
        bindings: {},
        condition: 'user.active == false',
      };

      const input: TemplateNodeInput = {
        nodeId: 'node-1',
        config,
        context: { user: { active: true } },
        tenantId: testTenantId,
      };

      const result = await executeTemplateNode(input);

      expect(result.status).toBe('skipped');
      expect(result.skipReason).toContain('condition');
    });

    it('should execute when condition evaluates to true', async () => {
      const config: TemplateNodeConfig = {
        templateId: testTemplateId1,
        bindings: {},
        condition: 'user.active == true',
      };

      const input: TemplateNodeInput = {
        nodeId: 'node-1',
        config,
        context: { user: { active: true } },
        tenantId: testTenantId,
      };

      const result = await executeTemplateNode(input);

      expect(result.status).toBe('executed');
    });
  });

  describe('Binding Resolution', () => {
    it('should resolve simple bindings', async () => {
      const config: TemplateNodeConfig = {
        templateId: testTemplateId1,
        bindings: {
          name: 'user.name',
          age: 'user.age',
        },
      };

      const input: TemplateNodeInput = {
        nodeId: 'node-1',
        config,
        context: { user: { name: 'Bob', age: 30 } },
        tenantId: testTenantId,
      };

      const result = await executeTemplateNode(input);

      expect(result.status).toBe('executed');
      expect(result.bindings).toEqual({
        name: 'Bob',
        age: 30,
      });
    });

    it('should handle binding resolution errors gracefully', async () => {
      const config: TemplateNodeConfig = {
        templateId: testTemplateId1,
        bindings: {
          name: 'nonexistent.property',
        },
      };

      const input: TemplateNodeInput = {
        nodeId: 'node-1',
        config,
        context: {},
        tenantId: testTenantId,
      };

      const result = await executeTemplateNode(input);

      expect(result.status).toBe('executed');
      expect(result.error).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should record failed output in runOutputs table', async () => {
      // Use invalid templateKey to trigger error
      const config: TemplateNodeConfig = {
        templateKey: 'nonexistent',
        bindings: {},
      };

      const input: TemplateNodeInput = {
        nodeId: 'node-1',
        config,
        context: {},
        tenantId: testTenantId,
        runId: testRunId,
        workflowVersionId: testVersionId,
      };

      const result = await executeTemplateNode(input);

      expect(result.status).toBe('executed');
      expect(result.error).toBeDefined();

      // Verify failed output was stored
      const outputs = await db
        .select()
        .from(runOutputs)
        .where(eq(runOutputs.runId, testRunId));

      expect(outputs).toHaveLength(1);
      expect(outputs[0].status).toBe('failed');
      expect(outputs[0].error).toBeDefined();
    });

    it('should not throw errors (should return error in result)', async () => {
      const config: TemplateNodeConfig = {
        templateId: 'invalid-id',
        bindings: {},
      };

      const input: TemplateNodeInput = {
        nodeId: 'node-1',
        config,
        context: {},
        tenantId: testTenantId,
      };

      // Should not throw
      await expect(executeTemplateNode(input)).resolves.toBeDefined();
    });
  });

  describe('Tenant Access Control', () => {
    it('should deny access to templates from different tenant', async () => {
      const config: TemplateNodeConfig = {
        templateId: testTemplateId1,
        bindings: {},
      };

      const input: TemplateNodeInput = {
        nodeId: 'node-1',
        config,
        context: {},
        tenantId: 'different-tenant-id', // Different tenant
      };

      const result = await executeTemplateNode(input);

      expect(result.status).toBe('executed');
      expect(result.error).toContain('Access denied');
    });
  });

  describe('Validation', () => {
    it('should require either templateKey or templateId', async () => {
      const config: TemplateNodeConfig = {
        bindings: {},
        // No templateKey or templateId
      };

      const input: TemplateNodeInput = {
        nodeId: 'node-1',
        config,
        context: {},
        tenantId: testTenantId,
      };

      const result = await executeTemplateNode(input);

      expect(result.status).toBe('executed');
      expect(result.error).toContain('must specify');
    });
  });
});
