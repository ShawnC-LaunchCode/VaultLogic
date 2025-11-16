import { describe, it, expect, beforeEach, vi } from "vitest";
import { AnalyticsRepository } from "../../../server/repositories/AnalyticsRepository";
import {
  createTestAnalyticsEvent,
  createTestSurveyJourney,
  createTestQuestionInteractions,
} from "../../factories/analyticsFactory";

describe("AnalyticsRepository", () => {
  let repository: AnalyticsRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn(),
      groupBy: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
    };

    repository = new AnalyticsRepository(mockDb);
  });

  describe("trackEvent", () => {
    it("should track a page view event", async () => {
      const eventData = {
        responseId: "response-123",
        surveyId: "survey-123",
        pageId: "page-123",
        event: "page_view" as const,
      };

      const expectedEvent = createTestAnalyticsEvent(eventData);
      mockDb.returning.mockResolvedValue([expectedEvent]);

      const result = await repository.trackEvent(eventData);

      expect(result.event).toBe("page_view");
      expect(result.pageId).toBe("page-123");
    });

    it("should track a question answer event with duration", async () => {
      const eventData = {
        responseId: "response-123",
        surveyId: "survey-123",
        questionId: "question-123",
        event: "question_answer" as const,
        duration: 45,
      };

      const expectedEvent = createTestAnalyticsEvent(eventData);
      mockDb.returning.mockResolvedValue([expectedEvent]);

      const result = await repository.trackEvent(eventData);

      expect(result.event).toBe("question_answer");
      expect(result.duration).toBe(45);
    });

    it("should track survey start event", async () => {
      const eventData = {
        responseId: "response-123",
        surveyId: "survey-123",
        event: "survey_start" as const,
      };

      const expectedEvent = createTestAnalyticsEvent(eventData);
      mockDb.returning.mockResolvedValue([expectedEvent]);

      const result = await repository.trackEvent(eventData);

      expect(result.event).toBe("survey_start");
      expect(result.pageId).toBeNull();
      expect(result.questionId).toBeNull();
    });
  });

  describe("getEventsBySurveyId", () => {
    it("should get all events for a survey", async () => {
      const events = Array.from({ length: 10 }, () =>
        createTestAnalyticsEvent({ surveyId: "survey-123" })
      );

      mockDb.where.mockResolvedValue(events);

      const result = await repository.getEventsBySurveyId("survey-123");

      expect(result).toHaveLength(10);
      expect(result.every(e => e.surveyId === "survey-123")).toBe(true);
    });

    it("should filter events by type", async () => {
      const pageViewEvents = Array.from({ length: 5 }, () =>
        createTestAnalyticsEvent({ surveyId: "survey-123", event: "page_view" })
      );

      mockDb.where.mockResolvedValue(pageViewEvents);

      const result = await repository.getEventsBySurveyId("survey-123", "page_view");

      expect(result).toHaveLength(5);
      expect(result.every(e => e.event === "page_view")).toBe(true);
    });
  });

  describe("getEventsByResponseId", () => {
    it("should get complete journey for a response", async () => {
      const events = createTestSurveyJourney(
        "response-123",
        "survey-123",
        ["page-1", "page-2", "page-3"],
        true
      );

      mockDb.where.mockResolvedValue(events);

      const result = await repository.getEventsByResponseId("response-123");

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].event).toBe("survey_start");
      expect(result[result.length - 1].event).toBe("survey_complete");
    });
  });

  describe("getQuestionMetrics", () => {
    it("should aggregate question interaction metrics", async () => {
      const metrics = {
        questionId: "question-123",
        viewCount: 100,
        answerCount: 85,
        skipCount: 10,
        avgDuration: 45,
      };

      mockDb.groupBy.mockResolvedValue([metrics]);

      const result = await repository.getQuestionMetrics("survey-123");

      expect(result).toBeDefined();
      expect(result[0].viewCount).toBe(100);
      expect(result[0].avgDuration).toBe(45);
    });
  });

  describe("getPageMetrics", () => {
    it("should aggregate page-level metrics", async () => {
      const metrics = {
        pageId: "page-1",
        viewCount: 150,
        leaveCount: 140,
        avgDuration: 120,
      };

      mockDb.groupBy.mockResolvedValue([metrics]);

      const result = await repository.getPageMetrics("survey-123");

      expect(result).toBeDefined();
      expect(result[0].pageId).toBe("page-1");
      expect(result[0].viewCount).toBe(150);
    });
  });

  describe("getCompletionFunnel", () => {
    it("should calculate drop-off rates per page", async () => {
      const funnelData = [
        { pageId: "page-1", order: 0, views: 100 },
        { pageId: "page-2", order: 1, views: 80 },
        { pageId: "page-3", order: 2, views: 60 },
      ];

      mockDb.groupBy.mockResolvedValue(funnelData);

      const result = await repository.getCompletionFunnel("survey-123");

      expect(result).toHaveLength(3);
      expect(result[0].views).toBe(100);
      expect(result[2].views).toBe(60);
    });
  });

  describe("getAverageCompletionTime", () => {
    it("should calculate average time from start to complete", async () => {
      mockDb.where.mockResolvedValue([{ avgTime: 300 }]); // 5 minutes

      const result = await repository.getAverageCompletionTime("survey-123");

      expect(result).toBe(300);
    });

    it("should return null if no completions", async () => {
      mockDb.where.mockResolvedValue([{ avgTime: null }]);

      const result = await repository.getAverageCompletionTime("survey-123");

      expect(result).toBeNull();
    });
  });
});
