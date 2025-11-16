import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../../server/index";
import { createTestUser } from "../../factories/userFactory";
import { createAuthenticatedAgent } from "../../factories/testHelpers";

/**
 * US-RS-031: Submit Anonymous Response
 *
 * As a survey respondent,
 * I want to submit responses anonymously via a public link,
 * So that I can participate without creating an account.
 */
describe("US-RS-031: Submit Anonymous Response", () => {
  let agent: request.SuperAgentTest;
  let user: any;
  let surveyId: string;
  let publicLink: string;
  let questionId: string;

  beforeEach(async () => {
    user = createTestUser();
    agent = await createAuthenticatedAgent(app, user);

    // Create anonymous survey
    const surveyResponse = await agent
      .post("/api/surveys")
      .send({
        title: "Public Feedback Survey",
        status: "open",
        allowAnonymous: true,
        anonymousAccessType: "unlimited",
      });

    surveyId = surveyResponse.body.id;
    publicLink = surveyResponse.body.publicLink;

    // Add page and question
    const pageResponse = await agent
      .post(`/api/surveys/${surveyId}/pages`)
      .send({ title: "Page 1" });

    const pageId = pageResponse.body.id;

    const questionResponse = await agent
      .post(`/api/surveys/${surveyId}/pages/${pageId}/questions`)
      .send({
        type: "short_text",
        title: "What do you think?",
        required: true,
      });

    questionId = questionResponse.body.id;
  });

  it("should create anonymous response via public link", async () => {
    const response = await request(app)
      .post(`/api/surveys/${publicLink}/responses`)
      .send({
        ipAddress: "192.168.1.100",
        userAgent: "Mozilla/5.0 Test Browser",
      })
      .expect(201);

    expect(response.body.isAnonymous).toBe(true);
    expect(response.body.recipientId).toBeNull();
    expect(response.body.ipAddress).toBe("192.168.1.100");
  });

  it("should submit anonymous answers", async () => {
    // Create anonymous response
    const responseCreation = await request(app)
      .post(`/api/surveys/${publicLink}/responses`)
      .send({
        ipAddress: "192.168.1.100",
        userAgent: "Test Browser",
      });

    const responseId = responseCreation.body.id;

    // Submit answer (no authentication required)
    const answerResponse = await request(app)
      .post(`/api/responses/${responseId}/answers`)
      .send({
        questionId,
        value: { text: "Anonymous feedback" },
      })
      .expect(200);

    expect(answerResponse.body.value).toEqual({ text: "Anonymous feedback" });
  });

  it("should complete anonymous response", async () => {
    // Create response
    const responseCreation = await request(app)
      .post(`/api/surveys/${publicLink}/responses`)
      .send({ ipAddress: "192.168.1.100" });

    const responseId = responseCreation.body.id;

    // Submit answer
    await request(app)
      .post(`/api/responses/${responseId}/answers`)
      .send({ questionId, value: { text: "Answer" } });

    // Complete
    const completeResponse = await request(app)
      .put(`/api/responses/${responseId}/complete`)
      .send({})
      .expect(200);

    expect(completeResponse.body.completed).toBe(true);
  });

  it("should reject anonymous response if survey doesn't allow it", async () => {
    // Create non-anonymous survey
    const privateSurvey = await agent
      .post("/api/surveys")
      .send({
        title: "Private Survey",
        status: "open",
        allowAnonymous: false,
      });

    // Try to create anonymous response (should fail)
    const response = await request(app)
      .post(`/api/surveys/${privateSurvey.body.id}/responses`)
      .send({ ipAddress: "192.168.1.100" })
      .expect(403);

    expect(response.body.error).toContain("not allowed");
  });

  it("should enforce one_per_ip limit", async () => {
    // Update survey to one_per_ip
    await agent
      .put(`/api/surveys/${surveyId}`)
      .send({ anonymousAccessType: "one_per_ip" });

    const ipAddress = "192.168.1.100";

    // First response - should succeed
    const firstResponse = await request(app)
      .post(`/api/surveys/${publicLink}/responses`)
      .send({ ipAddress })
      .expect(201);

    const responseId = firstResponse.body.id;

    // Submit answer and complete
    await request(app)
      .post(`/api/responses/${responseId}/answers`)
      .send({ questionId, value: { text: "Answer" } });

    await request(app).put(`/api/responses/${responseId}/complete`).send({});

    // Second response from same IP - should fail
    const secondResponse = await request(app)
      .post(`/api/surveys/${publicLink}/responses`)
      .send({ ipAddress })
      .expect(429);

    expect(secondResponse.body.error).toContain("already submitted");
  });

  it("should enforce one_per_session limit", async () => {
    // Update survey to one_per_session
    await agent
      .put(`/api/surveys/${surveyId}`)
      .send({ anonymousAccessType: "one_per_session" });

    const sessionId = "session-abc-123";

    // First response - should succeed
    const firstResponse = await request(app)
      .post(`/api/surveys/${publicLink}/responses`)
      .send({
        ipAddress: "192.168.1.100",
        sessionId,
      })
      .expect(201);

    const responseId = firstResponse.body.id;

    // Complete response
    await request(app)
      .post(`/api/responses/${responseId}/answers`)
      .send({ questionId, value: { text: "Answer" } });

    await request(app).put(`/api/responses/${responseId}/complete`).send({});

    // Second response from same session - should fail
    const secondResponse = await request(app)
      .post(`/api/surveys/${publicLink}/responses`)
      .send({
        ipAddress: "192.168.1.200", // Different IP, same session
        sessionId,
      })
      .expect(429);

    expect(secondResponse.body.error).toContain("already submitted");
  });

  it("should allow unlimited anonymous responses", async () => {
    const ipAddress = "192.168.1.100";

    // Create and complete first response
    const firstResponse = await request(app)
      .post(`/api/surveys/${publicLink}/responses`)
      .send({ ipAddress });

    await request(app)
      .post(`/api/responses/${firstResponse.body.id}/answers`)
      .send({ questionId, value: { text: "First" } });

    await request(app)
      .put(`/api/responses/${firstResponse.body.id}/complete`)
      .send({});

    // Create second response from same IP - should succeed
    const secondResponse = await request(app)
      .post(`/api/surveys/${publicLink}/responses`)
      .send({ ipAddress })
      .expect(201);

    expect(secondResponse.body.id).not.toBe(firstResponse.body.id);
  });

  it("should reject anonymous response if survey is closed", async () => {
    // Close survey
    await agent.put(`/api/surveys/${surveyId}`).send({ status: "closed" });

    const response = await request(app)
      .post(`/api/surveys/${publicLink}/responses`)
      .send({ ipAddress: "192.168.1.100" })
      .expect(403);

    expect(response.body.error).toContain("not open");
  });

  it("should track anonymous metadata", async () => {
    const metadata = {
      ipAddress: "192.168.1.100",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      sessionId: "session-123",
    };

    const response = await request(app)
      .post(`/api/surveys/${publicLink}/responses`)
      .send(metadata)
      .expect(201);

    expect(response.body.ipAddress).toBe(metadata.ipAddress);
    expect(response.body.userAgent).toBe(metadata.userAgent);
    expect(response.body.sessionId).toBe(metadata.sessionId);
  });
});
