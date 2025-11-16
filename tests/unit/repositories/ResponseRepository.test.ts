import { describe, it, expect, beforeEach, vi } from "vitest";
import { ResponseRepository } from "../../../server/repositories/ResponseRepository";
import {
  createTestResponse,
  createTestCompletedResponse,
  createTestAnonymousResponse,
  createTestAnswer,
} from "../../factories/responseFactory";
import { createTestSurvey } from "../../factories/surveyFactory";

describe("ResponseRepository", () => {
  let repository: ResponseRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    };

    repository = new ResponseRepository(mockDb);
  });

  describe("create", () => {
    it("should create a new response", async () => {
      const survey = createTestSurvey();
      const responseData = {
        surveyId: survey.id,
        recipientId: "recipient-123",
        isAnonymous: false,
      };

      const expectedResponse = createTestResponse(responseData);
      mockDb.returning.mockResolvedValue([expectedResponse]);

      const result = await repository.create(responseData);

      expect(result.surveyId).toBe(survey.id);
      expect(result.completed).toBe(false);
      expect(result.submittedAt).toBeNull();
    });

    it("should create an anonymous response", async () => {
      const survey = createTestSurvey();
      const anonymousData = {
        surveyId: survey.id,
        recipientId: null,
        isAnonymous: true,
        ipAddress: "192.168.1.1",
        sessionId: "session-123",
      };

      const expectedResponse = createTestAnonymousResponse(survey.id, anonymousData);
      mockDb.returning.mockResolvedValue([expectedResponse]);

      const result = await repository.create(anonymousData);

      expect(result.isAnonymous).toBe(true);
      expect(result.recipientId).toBeNull();
      expect(result.ipAddress).toBe("192.168.1.1");
    });
  });

  describe("findById", () => {
    it("should find a response by id", async () => {
      const response = createTestResponse();
      mockDb.where.mockResolvedValue([response]);

      const result = await repository.findById(response.id);

      expect(result).toBeDefined();
      expect(result?.id).toBe(response.id);
    });

    it("should return null if response not found", async () => {
      mockDb.where.mockResolvedValue([]);

      const result = await repository.findById("non-existent-id");

      expect(result).toBeNull();
    });
  });

  describe("findBySurveyId", () => {
    it("should find all responses for a survey", async () => {
      const survey = createTestSurvey();
      const responses = Array.from({ length: 5 }, () =>
        createTestResponse({ surveyId: survey.id })
      );

      mockDb.where.mockResolvedValue(responses);

      const result = await repository.findBySurveyId(survey.id);

      expect(result).toHaveLength(5);
      expect(result.every(r => r.surveyId === survey.id)).toBe(true);
    });
  });

  describe("markComplete", () => {
    it("should mark a response as completed", async () => {
      const response = createTestResponse();
      const completed = createTestCompletedResponse(response.surveyId, {
        id: response.id,
      });

      mockDb.returning.mockResolvedValue([completed]);

      const result = await repository.markComplete(response.id);

      expect(result?.completed).toBe(true);
      expect(result?.submittedAt).toBeDefined();
    });
  });

  describe("saveAnswer", () => {
    it("should save an answer", async () => {
      const response = createTestResponse();
      const answerData = {
        responseId: response.id,
        questionId: "question-123",
        value: { text: "My answer" },
      };

      const expectedAnswer = createTestAnswer(response.id, "question-123", {
        value: { text: "My answer" },
      });
      mockDb.returning.mockResolvedValue([expectedAnswer]);

      const result = await repository.saveAnswer(answerData);

      expect(result.responseId).toBe(response.id);
      expect(result.questionId).toBe("question-123");
      expect(result.value).toEqual({ text: "My answer" });
    });

    it("should save a loop answer with subquestion", async () => {
      const response = createTestResponse();
      const answerData = {
        responseId: response.id,
        questionId: "loop-question-123",
        subquestionId: "subquestion-456",
        loopIndex: 0,
        value: { text: "First iteration answer" },
      };

      const expectedAnswer = createTestAnswer(response.id, "loop-question-123", answerData);
      mockDb.returning.mockResolvedValue([expectedAnswer]);

      const result = await repository.saveAnswer(answerData);

      expect(result.subquestionId).toBe("subquestion-456");
      expect(result.loopIndex).toBe(0);
    });
  });

  describe("countBySurveyId", () => {
    it("should count total responses", async () => {
      mockDb.where.mockResolvedValue([{ count: 42 }]);

      const result = await repository.countBySurveyId("survey-123");

      expect(result).toBe(42);
    });

    it("should count only completed responses", async () => {
      mockDb.where.mockResolvedValue([{ count: 30 }]);

      const result = await repository.countBySurveyId("survey-123", true);

      expect(result).toBe(30);
    });
  });

  describe("checkAnonymousLimit", () => {
    it("should check if IP has already responded", async () => {
      mockDb.where.mockResolvedValue([{ exists: true }]);

      const result = await repository.checkAnonymousLimit("survey-123", "192.168.1.1");

      expect(result).toBe(true);
    });

    it("should return false if IP has not responded", async () => {
      mockDb.where.mockResolvedValue([{ exists: false }]);

      const result = await repository.checkAnonymousLimit("survey-123", "192.168.1.100");

      expect(result).toBe(false);
    });
  });
});
