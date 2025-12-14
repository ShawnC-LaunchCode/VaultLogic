
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import express, { type Express } from "express";
import { registerRoutes } from "../../server/routes";
import { db } from "../../server/db";
import { tenants, users, workflows, sections, steps, stepValues } from "@shared/schema";
import { setupAuth } from "../../server/googleAuth";
import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";

// Mock auth middleware to allow bypassing Google auth
vi.mock("../../server/googleAuth", async (importOriginal: any) => {
    const actual = await importOriginal();
    return {
        ...actual,
        setupAuth: (app: Express) => {
            app.use(actual.getSession());
            app.use((req, res, next) => {
                if (req.session && req.session.user) {
                    req.user = req.session.user;
                    req.isAuthenticated = () => true;
                } else {
                    req.isAuthenticated = () => false;
                }
                next();
            });

            app.post("/api/auth/mock-login", (req, res) => {
                if (req.body.user) {
                    req.session.user = req.body.user;
                    req.user = req.body.user;
                    return res.json({ message: "Logged in", user: req.body.user });
                }
                res.status(400).json({ error: "No user provided" });
            });
        },
    };
});

describe("Detailed Verification: JS Helper Availability", () => {
    let app: Express;
    let agent: any;
    let tenantId: string;
    let userId: string;
    let workflowId: string;

    beforeAll(async () => {
        app = express();
        app.use(express.json());
        app.use(express.urlencoded({ extended: false }));
        await registerRoutes(app);
        agent = request.agent(app);

        // Setup Tenant
        const [tenant] = await db.insert(tenants).values({
            name: "Helper Test Tenant",
            plan: "pro"
        }).returning();
        tenantId = tenant.id;

        // Setup User
        const [user] = await db.insert(users).values({
            email: `test-${nanoid()}@example.com`,
            tenantId,
            role: "admin",
            passwordHash: "mock",
            tenantRole: "owner"
        }).returning();
        userId = user.id;

        // Login
        const userWithClaims = {
            ...user,
            claims: {
                sub: user.id,
                email: user.email
            }
        };
        await agent.post("/api/auth/mock-login").send({ user: userWithClaims });

        // Create Workflow
        const [workflow] = await db.insert(workflows).values({
            tenantId,
            ownerId: userId,
            creatorId: userId,
            title: "JS Helper Test Workflow",
            slug: `js-helper-test-${nanoid()}`,
            published: true,
            version: 1,
            definition: {}
        }).returning();
        workflowId = workflow.id;
    });

    it("should execute a JS block that uses helper functions", async () => {
        // 1. Create a Section with a JS Question
        const [section] = await db.insert(sections).values({
            workflowId,
            title: "JS Section",
            order: 1
        }).returning();

        // 2. Create JS Step using helpers
        // We will test: helpers.date.now(), helpers.number.round(), helpers.string.upper()
        const code = `
        const now = helpers.date.now();
        const rounded = helpers.number.round(10.567, 2);
        const upper = helpers.string.upper("hello world");
        
        return {
            timestamp: now,
            rounded: rounded,
            greeting: upper
        };
    `;

        const [step] = await db.insert(steps).values({
            sectionId: section.id,
            title: "Helper Test Step",
            type: "js_question",
            order: 1,
            options: {
                display: "hidden",
                code: code,
                inputKeys: [],
                outputKey: "helperResult",
                timeoutMs: 2000
            }
        }).returning();

        // 3. Create a Run
        const runRes = await agent.post(`/api/workflows/${workflowId}/runs`).send({});
        expect(runRes.status).toBe(201); // 201 Created
        const runId = runRes.body.id;

        // 4. Submit the section (triggering execution)
        const submitRes = await agent.post(`/api/runs/${runId}/sections/${section.id}/submit`).send({
            values: []
        });

        if (submitRes.status !== 200) {
            throw new Error(`Submit failed with status ${submitRes.status}: ${JSON.stringify(submitRes.body, null, 2)}`);
        }

        expect(submitRes.status).toBe(200);

        // 5. Verify the value in DB
        const [savedValue] = await db.select().from(stepValues).where(
            and(
                eq(stepValues.runId, runId),
                eq(stepValues.stepId, step.id)
            )
        );

        expect(savedValue).toBeDefined();
        const result = savedValue.value as any;

        expect(result).toHaveProperty('timestamp');
        expect(result.rounded).toBe(10.57);
        expect(result.greeting).toBe("HELLO WORLD");
    });
});
