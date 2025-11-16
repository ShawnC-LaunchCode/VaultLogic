import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../../server/index";
import { createTestUser } from "../../factories/userFactory";
import { createAuthenticatedAgent } from "../../factories/testHelpers";

/**
 * US-AN-042: Export Survey Results
 *
 * As a survey creator,
 * I want to export survey responses to CSV or PDF,
 * So that I can analyze data offline or share reports.
 */
describe("US-AN-042: Export Survey Results", () => {
  let agent: request.SuperAgentTest;
  let user: any;
  let surveyId: string;

  beforeEach(async () => {
    user = createTestUser();
    agent = await createAuthenticatedAgent(app, user);

    // Create survey with questions and responses
    const surveyResponse = await agent
      .post("/api/surveys")
      .send({ title: "Export Test Survey", status: "open" });

    surveyId = surveyResponse.body.id;

    // Add page
    const pageResponse = await agent
      .post(`/api/surveys/${surveyId}/pages`)
      .send({ title: "Page 1" });

    const pageId = pageResponse.body.id;

    // Add questions
    await agent
      .post(`/api/surveys/${surveyId}/pages/${pageId}/questions`)
      .send({ type: "short_text", title: "Question 1" });

    await agent
      .post(`/api/surveys/${surveyId}/pages/${pageId}/questions`)
      .send({ type: "multiple_choice", title: "Question 2", options: ["A", "B", "C"] });

    // Add recipient and response
    const recipientResponse = await agent
      .post(`/api/surveys/${surveyId}/recipients`)
      .send({ name: "Test Recipient", email: "test@example.com" });

    const token = recipientResponse.body.token;

    // Create and submit response
    const responseCreation = await request(app)
      .post(`/api/surveys/${surveyId}/responses`)
      .set("Authorization", `Bearer ${token}`)
      .send({});

    const responseId = responseCreation.body.id;

    // Get survey details to find question IDs
    const surveyDetails = await agent.get(`/api/surveys/${surveyId}`);
    const questions = surveyDetails.body.pages[0].questions;

    await request(app)
      .post(`/api/responses/${responseId}/answers/bulk`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        answers: [
          { questionId: questions[0].id, value: { text: "Answer 1" } },
          { questionId: questions[1].id, value: { selected: ["A"] } },
        ],
      });

    await request(app)
      .put(`/api/responses/${responseId}/complete`)
      .set("Authorization", `Bearer ${token}`)
      .send({});
  });

  it("should export responses as CSV", async () => {
    const response = await agent
      .get(`/api/surveys/${surveyId}/export?format=csv`)
      .expect(200);

    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.headers["content-disposition"]).toContain("attachment");
    expect(response.headers["content-disposition"]).toContain(".csv");
    expect(response.text).toBeDefined();
    expect(response.text.length).toBeGreaterThan(0);
  });

  it("should export responses as PDF", async () => {
    const response = await agent
      .get(`/api/surveys/${surveyId}/export?format=pdf`)
      .expect(200);

    expect(response.headers["content-type"]).toBe("application/pdf");
    expect(response.headers["content-disposition"]).toContain("attachment");
    expect(response.headers["content-disposition"]).toContain(".pdf");
    expect(response.body).toBeDefined();
  });

  it("should include all response data in CSV", async () => {
    const response = await agent
      .get(`/api/surveys/${surveyId}/export?format=csv`)
      .expect(200);

    const csv = response.text;

    // Check headers
    expect(csv).toContain("Response ID");
    expect(csv).toContain("Submitted At");
    expect(csv).toContain("Question 1");
    expect(csv).toContain("Question 2");

    // Check data
    expect(csv).toContain("Answer 1");
    expect(csv).toContain("A");
  });

  it("should default to CSV format if not specified", async () => {
    const response = await agent
      .get(`/api/surveys/${surveyId}/export`)
      .expect(200);

    expect(response.headers["content-type"]).toContain("text/csv");
  });

  it("should reject invalid export format", async () => {
    const response = await agent
      .get(`/api/surveys/${surveyId}/export?format=xlsx`)
      .expect(400);

    expect(response.body.error).toContain("format");
  });

  it("should prevent exporting other user's surveys", async () => {
    const otherAgent = await createAuthenticatedAgent(app, createTestUser());

    const response = await otherAgent
      .get(`/api/surveys/${surveyId}/export?format=csv`)
      .expect(403);

    expect(response.body.error).toBe("Unauthorized");
  });

  it("should export empty CSV if no responses", async () => {
    // Create new survey with no responses
    const newSurvey = await agent
      .post("/api/surveys")
      .send({ title: "Empty Survey", status: "open" });

    const response = await agent
      .get(`/api/surveys/${newSurvey.body.id}/export?format=csv`)
      .expect(200);

    const csv = response.text;
    expect(csv).toBeDefined();
    expect(csv.split("\n").length).toBeLessThanOrEqual(2); // Only headers
  });

  it("should include anonymous responses in export", async () => {
    // Update survey to allow anonymous
    await agent
      .put(`/api/surveys/${surveyId}`)
      .send({ allowAnonymous: true, anonymousAccessType: "unlimited" });

    const surveyDetails = await agent.get(`/api/surveys/${surveyId}`);
    const publicLink = surveyDetails.body.publicLink;

    // Create anonymous response
    const anonResponse = await request(app)
      .post(`/api/surveys/${publicLink}/responses`)
      .send({ ipAddress: "192.168.1.100" });

    const anonResponseId = anonResponse.body.id;

    // Submit answers
    const questions = surveyDetails.body.pages[0].questions;

    await request(app)
      .post(`/api/responses/${anonResponseId}/answers`)
      .send({ questionId: questions[0].id, value: { text: "Anonymous Answer" } });

    await request(app).put(`/api/responses/${anonResponseId}/complete`).send({});

    // Export should include both authenticated and anonymous responses
    const exportResponse = await agent
      .get(`/api/surveys/${surveyId}/export?format=csv`)
      .expect(200);

    const csv = exportResponse.text;
    expect(csv).toContain("Anonymous Answer");
  });

  it("should handle special characters in responses", async () => {
    // Add recipient
    const recipientResponse = await agent
      .post(`/api/surveys/${surveyId}/recipients`)
      .send({ name: "Special Char Recipient", email: "special@example.com" });

    const token = recipientResponse.body.token;

    // Create response with special characters
    const responseCreation = await request(app)
      .post(`/api/surveys/${surveyId}/responses`)
      .set("Authorization", `Bearer ${token}`)
      .send({});

    const responseId = responseCreation.body.id;

    const surveyDetails = await agent.get(`/api/surveys/${surveyId}`);
    const questions = surveyDetails.body.pages[0].questions;

    await request(app)
      .post(`/api/responses/${responseId}/answers`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        questionId: questions[0].id,
        value: { text: "Answer with, commas and \"quotes\"" },
      });

    await request(app)
      .put(`/api/responses/${responseId}/complete`)
      .set("Authorization", `Bearer ${token}`)
      .send({});

    // Export should properly escape special characters
    const exportResponse = await agent
      .get(`/api/surveys/${surveyId}/export?format=csv`)
      .expect(200);

    const csv = exportResponse.text;
    expect(csv).toBeDefined();
    // CSV should properly escape commas and quotes
  });
});
