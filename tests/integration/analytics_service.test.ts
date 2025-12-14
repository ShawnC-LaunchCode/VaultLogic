import { describe, it, expect, beforeAll } from "vitest";
import { db } from "../../server/db";
import { runService } from "../../server/services/RunService";
import { createGraphWorkflow } from "../factories/graphFactory";
import { workflowRunEvents, workflowRunMetrics, projects, workflows, workflowVersions, users, tenants } from "@shared/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

describe("Analytics Service Integration", () => {
    let userId: string;
    let tenantId: string;
    let workflow: any;
    let version: any;

    beforeAll(async () => {
        const [tenant] = await db.insert(tenants).values({ name: "Service Test Tenant", plan: "pro" }).returning();
        tenantId = tenant.id;
        userId = `user-${nanoid()}`;
        await db.insert(users).values({ id: userId, email: `${userId}@test.com`, passwordHash: "x", tenantId, tenantRole: "owner", role: "admin" });
        const [p] = await db.insert(projects).values({ title: "P", name: "P", tenantId, creatorId: userId, ownerId: userId }).returning();

        const { workflow: w, version: v } = createGraphWorkflow({ projectId: p.id, creatorId: userId, status: "active", isPublic: true });
        const [wfRes] = await db.insert(workflows).values(w).returning();
        workflow = wfRes;

        const [vRes] = await db.insert(workflowVersions).values({
            ...v,
            workflowId: wfRes.id,
            published: true,
            publishedAt: new Date(),
            publishedBy: userId
        }).returning();
        version = vRes;
    });

    it("should generate events and metrics on run completion", async () => {
        // 1. Create Run via Service
        // Note: RunService.createRun expects a context or request info usually, but simplified sig might work if adjusted
        // Actually RunService.createRun(workflowId, inputData, queryParams, ...)
        // Looking at RunService signature: createRun(workflowId: string, options: ...)

        const run = await runService.createRun(workflow.id, undefined, { participantId: "anon" });
        const runId = run.id;
        const runToken = run.runToken;
        expect(runId).toBeDefined();

        // 2. Verify run.start event
        const eventsAfterStart = await db.select().from(workflowRunEvents).where(eq(workflowRunEvents.runId, runId));
        // It typically records run.start immediately
        expect(eventsAfterStart.some(e => e.type === 'run.start')).toBe(true);

        // 3. Complete Run
        // completeRun(runId, data, context)
        const context = {
            workflowId: workflow.id,
            runId: runId, // RunService usage usually derives this
            // But completeRun signature: async completeRun(runId: string, data: any = {})
            // Let's check signature.
        };

        // We'll call completeRun directly.
        await runService.completeRun(runId, { someOutput: "test" });

        // 4. Verify Events (workflow.complete)
        const events = await db.select().from(workflowRunEvents).where(eq(workflowRunEvents.runId, runId));
        expect(events.some(e => e.type === 'workflow.complete')).toBe(true);

        // 5. Verify Metrics Aggregation
        await new Promise(r => setTimeout(r, 1000));

        const metrics = await db.select().from(workflowRunMetrics).where(eq(workflowRunMetrics.runId, runId));
        expect(metrics.length).toBe(1);
        expect(metrics[0].completed).toBe(true);
    });
});
