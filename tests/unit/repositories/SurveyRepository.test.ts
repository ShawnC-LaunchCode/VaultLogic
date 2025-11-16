import { describe, it, expect, beforeEach, vi } from "vitest";
import { SurveyRepository } from "../../../server/repositories/SurveyRepository";
import { createTestSurvey, createTestSurveyWithQuestions } from "../../factories/surveyFactory";
import { createTestUser } from "../../factories/userFactory";

describe("SurveyRepository", () => {
  let repository: SurveyRepository;
  let mockDb: any;

  beforeEach(() => {
    // Mock database
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    };

    repository = new SurveyRepository(mockDb);
  });

  describe("create", () => {
    it("should create a new survey", async () => {
      const user = createTestUser();
      const surveyData = {
        title: "Customer Feedback Survey",
        description: "Help us improve",
        creatorId: user.id,
      };

      const expectedSurvey = createTestSurvey(surveyData);
      mockDb.returning.mockResolvedValue([expectedSurvey]);

      const result = await repository.create(surveyData);

      expect(result.title).toBe("Customer Feedback Survey");
      expect(result.status).toBe("draft");
      expect(result.creatorId).toBe(user.id);
    });
  });

  describe("findById", () => {
    it("should find a survey by id", async () => {
      const survey = createTestSurvey();
      mockDb.leftJoin.mockReturnThis();
      mockDb.where.mockResolvedValue([survey]);

      const result = await repository.findById(survey.id);

      expect(result).toBeDefined();
      expect(result?.id).toBe(survey.id);
    });

    it("should return null if survey not found", async () => {
      mockDb.where.mockResolvedValue([]);

      const result = await repository.findById("non-existent-id");

      expect(result).toBeNull();
    });
  });

  describe("findByCreatorId", () => {
    it("should find all surveys for a creator", async () => {
      const user = createTestUser();
      const surveys = Array.from({ length: 3 }, () =>
        createTestSurvey({ creatorId: user.id })
      );

      mockDb.where.mockResolvedValue(surveys);

      const result = await repository.findByCreatorId(user.id);

      expect(result).toHaveLength(3);
      expect(result.every(s => s.creatorId === user.id)).toBe(true);
    });
  });

  describe("update", () => {
    it("should update survey fields", async () => {
      const survey = createTestSurvey();
      const updates = { title: "Updated Title", status: "open" as const };

      const updatedSurvey = { ...survey, ...updates };
      mockDb.returning.mockResolvedValue([updatedSurvey]);

      const result = await repository.update(survey.id, updates);

      expect(result?.title).toBe("Updated Title");
      expect(result?.status).toBe("open");
    });
  });

  describe("delete", () => {
    it("should delete a survey", async () => {
      const survey = createTestSurvey();
      mockDb.where.mockResolvedValue(undefined);

      await expect(repository.delete(survey.id)).resolves.not.toThrow();
    });
  });

  describe("duplicate", () => {
    it("should create a copy of a survey", async () => {
      const original = createTestSurvey({ title: "Original Survey" });
      const duplicated = createTestSurvey({
        title: "Original Survey (Copy)",
        creatorId: original.creatorId,
      });

      mockDb.returning.mockResolvedValue([duplicated]);

      const result = await repository.duplicate(original.id, false);

      expect(result.title).toContain("(Copy)");
      expect(result.id).not.toBe(original.id);
    });
  });

  describe("findByPublicLink", () => {
    it("should find a survey by public link", async () => {
      const survey = createTestSurvey({
        allowAnonymous: true,
        publicLink: "abc-123-def",
      });

      mockDb.where.mockResolvedValue([survey]);

      const result = await repository.findByPublicLink("abc-123-def");

      expect(result).toBeDefined();
      expect(result?.publicLink).toBe("abc-123-def");
      expect(result?.allowAnonymous).toBe(true);
    });
  });

  describe("updateStatus", () => {
    it("should change survey status from draft to open", async () => {
      const survey = createTestSurvey({ status: "draft" });
      const updated = { ...survey, status: "open" as const };

      mockDb.returning.mockResolvedValue([updated]);

      const result = await repository.updateStatus(survey.id, "open");

      expect(result?.status).toBe("open");
    });
  });
});
