import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../../server/index";
import { createTestUser } from "../../factories/userFactory";
import { createAuthenticatedAgent } from "../../factories/testHelpers";

/**
 * US-C-004: Create New Survey
 *
 * As a creator,
 * I want to create a new survey with a title and description,
 * So that I can start building my survey.
 */
describe("US-C-004: Create New Survey", () => {
  let agent: request.SuperAgentTest;
  let user: any;

  beforeEach(async () => {
    user = createTestUser();
    agent = await createAuthenticatedAgent(app, user);
  });

  it("should create a new survey with title and description", async () => {
    const surveyData = {
      title: "Customer Feedback Survey",
      description: "Help us improve our products and services",
    };

    const response = await agent
      .post("/api/surveys")
      .send(surveyData)
      .expect(201);

    expect(response.body).toHaveProperty("id");
    expect(response.body.title).toBe(surveyData.title);
    expect(response.body.description).toBe(surveyData.description);
    expect(response.body.status).toBe("draft");
    expect(response.body.creatorId).toBe(user.id);
  });

  it("should create a survey with only title (description optional)", async () => {
    const surveyData = {
      title: "Quick Poll",
    };

    const response = await agent
      .post("/api/surveys")
      .send(surveyData)
      .expect(201);

    expect(response.body.title).toBe(surveyData.title);
    expect(response.body.description).toBeNull();
  });

  it("should reject survey creation without title", async () => {
    const response = await agent
      .post("/api/surveys")
      .send({ description: "Missing title" })
      .expect(400);

    expect(response.body).toHaveProperty("error");
  });

  it("should reject survey creation for unauthenticated users", async () => {
    const response = await request(app)
      .post("/api/surveys")
      .send({ title: "Unauthorized Survey" })
      .expect(401);

    expect(response.body).toHaveProperty("error", "Not authenticated");
  });

  it("should auto-generate publicLink when allowAnonymous is enabled", async () => {
    const surveyData = {
      title: "Anonymous Survey",
      allowAnonymous: true,
      anonymousAccessType: "unlimited",
    };

    const response = await agent
      .post("/api/surveys")
      .send(surveyData)
      .expect(201);

    expect(response.body.allowAnonymous).toBe(true);
    expect(response.body.publicLink).toBeDefined();
    expect(response.body.publicLink).toMatch(/^[a-f0-9-]{36}$/); // UUID format
  });
});

describe("US-C-005: List User Surveys", () => {
  let agent: request.SuperAgentTest;
  let user: any;

  beforeEach(async () => {
    user = createTestUser();
    agent = await createAuthenticatedAgent(app, user);
  });

  it("should list all surveys created by the user", async () => {
    // Create multiple surveys
    await agent.post("/api/surveys").send({ title: "Survey 1" });
    await agent.post("/api/surveys").send({ title: "Survey 2" });
    await agent.post("/api/surveys").send({ title: "Survey 3" });

    const response = await agent.get("/api/surveys").expect(200);

    expect(response.body).toBeInstanceOf(Array);
    expect(response.body.length).toBeGreaterThanOrEqual(3);
    expect(response.body.every((s: any) => s.creatorId === user.id)).toBe(true);
  });

  it("should support pagination", async () => {
    const response = await agent
      .get("/api/surveys?limit=10&offset=0")
      .expect(200);

    expect(response.body).toBeInstanceOf(Array);
    expect(response.body.length).toBeLessThanOrEqual(10);
  });

  it("should return empty array for new users", async () => {
    const newAgent = await createAuthenticatedAgent(app, createTestUser());

    const response = await newAgent.get("/api/surveys").expect(200);

    expect(response.body).toEqual([]);
  });
});

describe("US-C-006: Get Survey Details", () => {
  let agent: request.SuperAgentTest;
  let user: any;

  beforeEach(async () => {
    user = createTestUser();
    agent = await createAuthenticatedAgent(app, user);
  });

  it("should get survey with pages and questions", async () => {
    // Create survey
    const surveyResponse = await agent
      .post("/api/surveys")
      .send({ title: "Detailed Survey" });

    const surveyId = surveyResponse.body.id;

    // Add page
    const pageResponse = await agent
      .post(`/api/surveys/${surveyId}/pages`)
      .send({ title: "Page 1" });

    const pageId = pageResponse.body.id;

    // Add question
    await agent
      .post(`/api/surveys/${surveyId}/pages/${pageId}/questions`)
      .send({ type: "short_text", title: "What is your name?" });

    // Get survey details
    const response = await agent.get(`/api/surveys/${surveyId}`).expect(200);

    expect(response.body).toHaveProperty("id", surveyId);
    expect(response.body).toHaveProperty("pages");
    expect(response.body.pages).toHaveLength(1);
    expect(response.body.pages[0].questions).toHaveLength(1);
  });

  it("should return 404 for non-existent survey", async () => {
    const response = await agent
      .get("/api/surveys/non-existent-id")
      .expect(404);

    expect(response.body).toHaveProperty("error");
  });

  it("should prevent access to other user's surveys", async () => {
    // Create survey with first user
    const survey1Response = await agent
      .post("/api/surveys")
      .send({ title: "User 1 Survey" });

    const surveyId = survey1Response.body.id;

    // Try to access with different user
    const otherAgent = await createAuthenticatedAgent(app, createTestUser());
    const response = await otherAgent.get(`/api/surveys/${surveyId}`).expect(403);

    expect(response.body).toHaveProperty("error", "Unauthorized");
  });
});

describe("US-C-007: Update Survey", () => {
  let agent: request.SuperAgentTest;
  let user: any;

  beforeEach(async () => {
    user = createTestUser();
    agent = await createAuthenticatedAgent(app, user);
  });

  it("should update survey title and description", async () => {
    const surveyResponse = await agent
      .post("/api/surveys")
      .send({ title: "Original Title", description: "Original Description" });

    const surveyId = surveyResponse.body.id;

    const updateResponse = await agent
      .put(`/api/surveys/${surveyId}`)
      .send({
        title: "Updated Title",
        description: "Updated Description",
      })
      .expect(200);

    expect(updateResponse.body.title).toBe("Updated Title");
    expect(updateResponse.body.description).toBe("Updated Description");
  });

  it("should update survey status", async () => {
    const surveyResponse = await agent
      .post("/api/surveys")
      .send({ title: "Survey to Publish" });

    const surveyId = surveyResponse.body.id;

    const updateResponse = await agent
      .put(`/api/surveys/${surveyId}`)
      .send({ status: "open" })
      .expect(200);

    expect(updateResponse.body.status).toBe("open");
  });

  it("should prevent updating other user's surveys", async () => {
    const surveyResponse = await agent
      .post("/api/surveys")
      .send({ title: "User 1 Survey" });

    const surveyId = surveyResponse.body.id;

    const otherAgent = await createAuthenticatedAgent(app, createTestUser());
    const response = await otherAgent
      .put(`/api/surveys/${surveyId}`)
      .send({ title: "Unauthorized Update" })
      .expect(403);

    expect(response.body).toHaveProperty("error", "Unauthorized");
  });
});

describe("US-C-008: Delete Survey", () => {
  let agent: request.SuperAgentTest;
  let user: any;

  beforeEach(async () => {
    user = createTestUser();
    agent = await createAuthenticatedAgent(app, user);
  });

  it("should delete survey and cascade to pages/questions", async () => {
    const surveyResponse = await agent
      .post("/api/surveys")
      .send({ title: "Survey to Delete" });

    const surveyId = surveyResponse.body.id;

    await agent.delete(`/api/surveys/${surveyId}`).expect(204);

    // Verify it's gone
    await agent.get(`/api/surveys/${surveyId}`).expect(404);
  });

  it("should prevent deleting other user's surveys", async () => {
    const surveyResponse = await agent
      .post("/api/surveys")
      .send({ title: "User 1 Survey" });

    const surveyId = surveyResponse.body.id;

    const otherAgent = await createAuthenticatedAgent(app, createTestUser());
    await otherAgent.delete(`/api/surveys/${surveyId}`).expect(403);

    // Verify it still exists
    await agent.get(`/api/surveys/${surveyId}`).expect(200);
  });
});
