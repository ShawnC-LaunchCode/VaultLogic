import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../../server/index";
import { createTestUser } from "../../factories/userFactory";
import { createAuthenticatedAgent } from "../../factories/testHelpers";

/**
 * US-RS-030: Submit Authenticated Response
 *
 * As a survey recipient,
 * I want to submit my responses to survey questions,
 * So that my feedback is recorded.
 */
describe("US-RS-030: Submit Authenticated Response", () => {
  let agent: request.SuperAgentTest;
  let user: any;
  let surveyId: string;
  let questionId: string;
  let recipientToken: string;

  beforeEach(async () => {
    user = createTestUser();
    agent = await createAuthenticatedAgent(app, user);

    // Create a survey with questions
    const surveyResponse = await agent
      .post("/api/surveys")
      .send({ title: "Feedback Survey", status: "open" });

    surveyId = surveyResponse.body.id;

    // Add page
    const pageResponse = await agent
      .post(`/api/surveys/${surveyId}/pages`)
      .send({ title: "Page 1" });

    const pageId = pageResponse.body.id;

    // Add question
    const questionResponse = await agent
      .post(`/api/surveys/${surveyId}/pages/${pageId}/questions`)
      .send({
        type: "short_text",
        title: "How satisfied are you?",
        required: true,
      });

    questionId = questionResponse.body.id;

    // Add recipient
    const recipientResponse = await agent
      .post(`/api/surveys/${surveyId}/recipients`)
      .send({ name: "Test Recipient", email: "recipient@example.com" });

    recipientToken = recipientResponse.body.token;
  });

  it("should create a response for authenticated recipient", async () => {
    const response = await request(app)
      .post(`/api/surveys/${surveyId}/responses`)
      .set("Authorization", `Bearer ${recipientToken}`)
      .send({})
      .expect(201);

    expect(response.body).toHaveProperty("id");
    expect(response.body.surveyId).toBe(surveyId);
    expect(response.body.completed).toBe(false);
    expect(response.body.isAnonymous).toBe(false);
  });

  it("should save answers to questions", async () => {
    // Create response
    const responseCreation = await request(app)
      .post(`/api/surveys/${surveyId}/responses`)
      .set("Authorization", `Bearer ${recipientToken}`)
      .send({});

    const responseId = responseCreation.body.id;

    // Submit answer
    const answerResponse = await request(app)
      .post(`/api/responses/${responseId}/answers`)
      .set("Authorization", `Bearer ${recipientToken}`)
      .send({
        questionId,
        value: { text: "Very satisfied" },
      })
      .expect(200);

    expect(answerResponse.body.questionId).toBe(questionId);
    expect(answerResponse.body.value).toEqual({ text: "Very satisfied" });
  });

  it("should save multiple answers in bulk", async () => {
    // Create response
    const responseCreation = await request(app)
      .post(`/api/surveys/${surveyId}/responses`)
      .set("Authorization", `Bearer ${recipientToken}`)
      .send({});

    const responseId = responseCreation.body.id;

    // Add another question
    const pageResponse = await agent.get(`/api/surveys/${surveyId}`);
    const pageId = pageResponse.body.pages[0].id;

    const question2Response = await agent
      .post(`/api/surveys/${surveyId}/pages/${pageId}/questions`)
      .send({ type: "long_text", title: "Any comments?" });

    const question2Id = question2Response.body.id;

    // Submit multiple answers
    const bulkResponse = await request(app)
      .post(`/api/responses/${responseId}/answers/bulk`)
      .set("Authorization", `Bearer ${recipientToken}`)
      .send({
        answers: [
          { questionId, value: { text: "Very satisfied" } },
          { questionId: question2Id, value: { text: "Great product!" } },
        ],
      })
      .expect(200);

    expect(bulkResponse.body).toHaveLength(2);
  });

  it("should mark response as complete", async () => {
    // Create response
    const responseCreation = await request(app)
      .post(`/api/surveys/${surveyId}/responses`)
      .set("Authorization", `Bearer ${recipientToken}`)
      .send({});

    const responseId = responseCreation.body.id;

    // Submit answer to required question
    await request(app)
      .post(`/api/responses/${responseId}/answers`)
      .set("Authorization", `Bearer ${recipientToken}`)
      .send({
        questionId,
        value: { text: "Very satisfied" },
      });

    // Complete response
    const completeResponse = await request(app)
      .put(`/api/responses/${responseId}/complete`)
      .set("Authorization", `Bearer ${recipientToken}`)
      .send({})
      .expect(200);

    expect(completeResponse.body.completed).toBe(true);
    expect(completeResponse.body.submittedAt).toBeDefined();
  });

  it("should reject completion if required questions are unanswered", async () => {
    // Create response
    const responseCreation = await request(app)
      .post(`/api/surveys/${surveyId}/responses`)
      .set("Authorization", `Bearer ${recipientToken}`)
      .send({});

    const responseId = responseCreation.body.id;

    // Try to complete without answering required question
    const completeResponse = await request(app)
      .put(`/api/responses/${responseId}/complete`)
      .set("Authorization", `Bearer ${recipientToken}`)
      .send({})
      .expect(400);

    expect(completeResponse.body).toHaveProperty("error");
    expect(completeResponse.body.error).toContain("required");
  });

  it("should prevent answering after response is completed", async () => {
    // Create and complete response
    const responseCreation = await request(app)
      .post(`/api/surveys/${surveyId}/responses`)
      .set("Authorization", `Bearer ${recipientToken}`)
      .send({});

    const responseId = responseCreation.body.id;

    await request(app)
      .post(`/api/responses/${responseId}/answers`)
      .set("Authorization", `Bearer ${recipientToken}`)
      .send({ questionId, value: { text: "Answer" } });

    await request(app)
      .put(`/api/responses/${responseId}/complete`)
      .set("Authorization", `Bearer ${recipientToken}`)
      .send({});

    // Try to add another answer
    const lateAnswerResponse = await request(app)
      .post(`/api/responses/${responseId}/answers`)
      .set("Authorization", `Bearer ${recipientToken}`)
      .send({ questionId, value: { text: "Late answer" } })
      .expect(400);

    expect(lateAnswerResponse.body).toHaveProperty("error");
  });

  it("should reject response submission if survey is closed", async () => {
    // Close the survey
    await agent
      .put(`/api/surveys/${surveyId}`)
      .send({ status: "closed" });

    // Try to create response
    const response = await request(app)
      .post(`/api/surveys/${surveyId}/responses`)
      .set("Authorization", `Bearer ${recipientToken}`)
      .send({})
      .expect(403);

    expect(response.body).toHaveProperty("error");
    expect(response.body.error).toContain("not open");
  });
});

describe("US-RS-031: View Response Progress", () => {
  let agent: request.SuperAgentTest;
  let user: any;
  let surveyId: string;
  let recipientToken: string;

  beforeEach(async () => {
    user = createTestUser();
    agent = await createAuthenticatedAgent(app, user);

    // Setup survey and recipient
    const surveyResponse = await agent
      .post("/api/surveys")
      .send({ title: "Progress Test Survey", status: "open" });

    surveyId = surveyResponse.body.id;

    const recipientResponse = await agent
      .post(`/api/surveys/${surveyId}/recipients`)
      .send({ name: "Test User", email: "test@example.com" });

    recipientToken = recipientResponse.body.token;
  });

  it("should get incomplete response for editing", async () => {
    // Create response
    const responseCreation = await request(app)
      .post(`/api/surveys/${surveyId}/responses`)
      .set("Authorization", `Bearer ${recipientToken}`)
      .send({});

    const responseId = responseCreation.body.id;

    // Get response
    const getResponse = await request(app)
      .get(`/api/responses/${responseId}`)
      .set("Authorization", `Bearer ${recipientToken}`)
      .expect(200);

    expect(getResponse.body.id).toBe(responseId);
    expect(getResponse.body.completed).toBe(false);
  });
});
