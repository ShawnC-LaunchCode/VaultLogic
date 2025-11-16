import {
  surveys,
  surveyPages,
  questions,
  responses,
  answers,
  analyticsEvents,
  files,
  anonymousResponseTracking,
  type User,
  type UpsertUser,
  type Survey,
  type InsertSurvey,
  type SurveyPage,
  type InsertSurveyPage,
  type Question,
  type InsertQuestion,
  type LoopGroupSubquestion,
  type InsertLoopGroupSubquestion,
  type ConditionalRule,
  type InsertConditionalRule,
  type QuestionWithSubquestions,
  type Response,
  type InsertResponse,
  type Answer,
  type InsertAnswer,
  type AnalyticsEvent,
  type DashboardStats,
  type ActivityItem,
  type SurveyAnalytics,
  type ResponseTrend,
  type BulkOperationRequest,
  type BulkOperationResult,
  type SurveyDuplication,
  type FileMetadata,
  type QuestionAnalytics,
  type PageAnalytics,
  type CompletionFunnelData,
  type TimeSpentData,
  type EngagementMetrics,
  type AnonymousResponseTracking,
  type InsertAnonymousResponseTracking,
  type AnonymousSurveyConfig,
} from "@shared/schema";
import { db } from "./db";
import { logger } from "./logger";
import { eq, desc, and, count, sql, gte, inArray, type ExtractTablesWithRelations } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import { randomUUID } from "crypto";

// Import repositories
import {
  userRepository,
  surveyRepository,
  pageRepository,
  questionRepository,
  responseRepository,
  analyticsRepository,
  fileRepository,
} from "./repositories";

// Type alias for database transactions
type DbTransaction = PgTransaction<NodePgQueryResultHKT, Record<string, never>, ExtractTablesWithRelations<Record<string, never>>>;

export interface IStorage {
  // Health check operations
  ping(): Promise<boolean>;
  
  // User operations (required for Google Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Survey operations
  createSurvey(survey: InsertSurvey): Promise<Survey>;
  getSurvey(id: string): Promise<Survey | undefined>;
  getSurveysByCreator(creatorId: string): Promise<Survey[]>;
  updateSurvey(id: string, updates: Partial<InsertSurvey>): Promise<Survey>;
  deleteSurvey(id: string): Promise<void>;
  
  // Survey page operations
  createSurveyPage(page: InsertSurveyPage): Promise<SurveyPage>;
  getSurveyPage(id: string): Promise<SurveyPage | undefined>;
  getSurveyPages(surveyId: string): Promise<SurveyPage[]>;
  getSurveyPagesWithQuestions(surveyId: string): Promise<(SurveyPage & { questions: Question[] })[]>;
  updateSurveyPage(id: string, updates: Partial<InsertSurveyPage>): Promise<SurveyPage>;
  deleteSurveyPage(id: string): Promise<void>;
  bulkReorderPages(surveyId: string, pageOrders: Array<{ id: string; order: number }>): Promise<SurveyPage[]>;
  
  // Question operations
  createQuestion(question: InsertQuestion): Promise<Question>;
  getQuestion(id: string): Promise<Question | undefined>;
  getQuestionsByPage(pageId: string): Promise<Question[]>;
  getQuestionsWithSubquestionsByPage(pageId: string): Promise<QuestionWithSubquestions[]>;
  updateQuestion(id: string, updates: Partial<InsertQuestion>): Promise<Question>;
  deleteQuestion(id: string): Promise<void>;
  bulkReorderQuestions(surveyId: string, questionOrders: Array<{ id: string; pageId: string; order: number }>): Promise<Question[]>;
  
  // Loop group subquestion operations
  createLoopGroupSubquestion(subquestion: InsertLoopGroupSubquestion): Promise<LoopGroupSubquestion>;
  getLoopGroupSubquestion(id: string): Promise<LoopGroupSubquestion | undefined>;
  getLoopGroupSubquestions(loopQuestionId: string): Promise<LoopGroupSubquestion[]>;
  updateLoopGroupSubquestion(id: string, updates: Partial<InsertLoopGroupSubquestion>): Promise<LoopGroupSubquestion>;
  deleteLoopGroupSubquestion(id: string): Promise<void>;
  deleteLoopGroupSubquestionsByLoopId(loopQuestionId: string): Promise<void>;
  
  // Conditional rules operations
  createConditionalRule(rule: InsertConditionalRule): Promise<ConditionalRule>;
  getConditionalRule(id: string): Promise<ConditionalRule | undefined>;
  getConditionalRulesBySurvey(surveyId: string): Promise<ConditionalRule[]>;
  getConditionalRulesByQuestion(questionId: string): Promise<ConditionalRule[]>;
  updateConditionalRule(id: string, updates: Partial<InsertConditionalRule>): Promise<ConditionalRule>;
  deleteConditionalRule(id: string): Promise<void>;
  deleteConditionalRulesBySurvey(surveyId: string): Promise<void>;
  
  // Response operations
  createResponse(response: InsertResponse): Promise<Response>;
  getResponse(id: string): Promise<Response | undefined>;
  getResponsesBySurvey(surveyId: string): Promise<Response[]>;
  updateResponse(id: string, updates: Partial<InsertResponse>): Promise<Response>;
  
  // Answer operations
  createAnswer(answer: InsertAnswer): Promise<Answer>;
  getAnswer(id: string): Promise<Answer | undefined>;
  getAnswersByResponse(responseId: string): Promise<Answer[]>;
  getAnswersWithQuestionsByResponse(responseId: string): Promise<(Answer & { question: Question })[]>;
  updateAnswer(id: string, updates: Partial<InsertAnswer>): Promise<Answer>;
  
  // Analytics operations
  createAnalyticsEvent(event: Omit<AnalyticsEvent, 'id' | 'timestamp'>): Promise<AnalyticsEvent>;
  getAnalyticsByResponse(responseId: string): Promise<AnalyticsEvent[]>;
  getAnalyticsBySurvey(surveyId: string): Promise<AnalyticsEvent[]>;
  
  // Advanced analytics
  getQuestionAnalytics(surveyId: string): Promise<QuestionAnalytics[]>;
  getPageAnalytics(surveyId: string): Promise<PageAnalytics[]>;
  getCompletionFunnelData(surveyId: string): Promise<CompletionFunnelData[]>;
  getTimeSpentData(surveyId: string): Promise<TimeSpentData[]>;
  getEngagementMetrics(surveyId: string): Promise<EngagementMetrics>;
  
  // Enhanced dashboard analytics
  getDashboardStats(creatorId: string): Promise<DashboardStats>;
  getSurveyAnalytics(creatorId: string): Promise<SurveyAnalytics[]>;
  getResponseTrends(creatorId: string, days?: number): Promise<ResponseTrend[]>;
  getRecentActivity(creatorId: string, limit?: number): Promise<ActivityItem[]>;
  
  // Bulk operations
  bulkUpdateSurveyStatus(surveyIds: string[], status: string, creatorId: string): Promise<BulkOperationResult>;
  bulkDeleteSurveys(surveyIds: string[], creatorId: string): Promise<BulkOperationResult>;
  
  // Survey management
  duplicateSurvey(surveyId: string, newTitle: string, creatorId: string): Promise<Survey>;
  archiveSurvey(surveyId: string, creatorId: string): Promise<Survey>;
  
  // File operations
  createFile(fileData: {
    answerId: string;
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
  }): Promise<FileMetadata>;
  getFile(id: string): Promise<FileMetadata | undefined>;
  getFilesByAnswer(answerId: string): Promise<FileMetadata[]>;
  deleteFile(id: string): Promise<void>;
  deleteFilesByAnswer(answerId: string): Promise<void>;
  
  // Anonymous survey operations
  getSurveyByPublicLink(publicLink: string): Promise<Survey | undefined>;
  generatePublicLink(surveyId: string): Promise<string>;
  enableAnonymousAccess(surveyId: string, config: { accessType: string; anonymousConfig?: AnonymousSurveyConfig }): Promise<Survey>;
  disableAnonymousAccess(surveyId: string): Promise<Survey>;
  
  // Anonymous response operations
  createAnonymousResponse(data: {
    surveyId: string;
    ipAddress: string;
    userAgent?: string;
    sessionId?: string;
    anonymousMetadata?: any;
  }): Promise<Response>;
  checkAnonymousResponseLimit(surveyId: string, ipAddress: string, sessionId?: string): Promise<boolean>;
  createAnonymousResponseTracking(tracking: InsertAnonymousResponseTracking): Promise<AnonymousResponseTracking>;
  getAnonymousResponsesBySurvey(surveyId: string): Promise<Response[]>;
  getAnonymousResponseCount(surveyId: string): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  // Health check operations
  async ping(): Promise<boolean> {
    return await userRepository.ping();
  }

  // User operations (required for Google Auth)
  async getUser(id: string): Promise<User | undefined> {
    return await userRepository.findById(id);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    return await userRepository.upsert(userData);
  }
  
  // Survey operations
  async createSurvey(survey: InsertSurvey): Promise<Survey> {
    return await surveyRepository.create(survey);
  }

  async getSurvey(id: string): Promise<Survey | undefined> {
    return await surveyRepository.findById(id);
  }

  async getSurveysByCreator(creatorId: string): Promise<Survey[]> {
    return await surveyRepository.findByCreator(creatorId);
  }

  async updateSurvey(id: string, updates: Partial<InsertSurvey>): Promise<Survey> {
    return await surveyRepository.update(id, updates);
  }

  async deleteSurvey(id: string): Promise<void> {
    await surveyRepository.delete(id);
  }
  
  // Survey page operations
  async createSurveyPage(page: InsertSurveyPage): Promise<SurveyPage> {
    return await pageRepository.create(page);
  }

  async getSurveyPage(id: string): Promise<SurveyPage | undefined> {
    return await pageRepository.findById(id);
  }

  async getSurveyPages(surveyId: string): Promise<SurveyPage[]> {
    return await pageRepository.findBySurvey(surveyId);
  }

  async getSurveyPagesWithQuestions(surveyId: string): Promise<(SurveyPage & { questions: Question[] })[]> {
    return await pageRepository.findBySurveyWithQuestions(surveyId);
  }

  async updateSurveyPage(id: string, updates: Partial<InsertSurveyPage>): Promise<SurveyPage> {
    return await pageRepository.update(id, updates);
  }

  async deleteSurveyPage(id: string): Promise<void> {
    await pageRepository.delete(id);
  }

  async bulkReorderPages(surveyId: string, pageOrders: Array<{ id: string; order: number }>): Promise<SurveyPage[]> {
    return await pageRepository.bulkReorder(surveyId, pageOrders);
  }

  // Question operations
  async createQuestion(question: InsertQuestion): Promise<Question> {
    return await questionRepository.create(question);
  }

  async getQuestionsByPage(pageId: string): Promise<Question[]> {
    return await questionRepository.findByPage(pageId);
  }

  async updateQuestion(id: string, updates: Partial<InsertQuestion>): Promise<Question> {
    return await questionRepository.update(id, updates);
  }

  async getQuestion(id: string): Promise<Question | undefined> {
    return await questionRepository.findById(id);
  }

  async deleteQuestion(id: string): Promise<void> {
    await questionRepository.delete(id);
  }

  async bulkReorderQuestions(surveyId: string, questionOrders: Array<{ id: string; pageId: string; order: number }>): Promise<Question[]> {
    return await questionRepository.bulkReorder(surveyId, questionOrders);
  }

  async getQuestionsWithSubquestionsByPage(pageId: string): Promise<QuestionWithSubquestions[]> {
    return await questionRepository.findByPageWithSubquestions(pageId);
  }

  // Loop group subquestion operations
  async createLoopGroupSubquestion(subquestion: InsertLoopGroupSubquestion): Promise<LoopGroupSubquestion> {
    return await questionRepository.createSubquestion(subquestion);
  }

  async getLoopGroupSubquestion(id: string): Promise<LoopGroupSubquestion | undefined> {
    return await questionRepository.findSubquestionById(id);
  }

  async getLoopGroupSubquestions(loopQuestionId: string): Promise<LoopGroupSubquestion[]> {
    return await questionRepository.findSubquestionsByLoopId(loopQuestionId);
  }

  async updateLoopGroupSubquestion(id: string, updates: Partial<InsertLoopGroupSubquestion>): Promise<LoopGroupSubquestion> {
    return await questionRepository.updateSubquestion(id, updates);
  }

  async deleteLoopGroupSubquestion(id: string): Promise<void> {
    await questionRepository.deleteSubquestion(id);
  }

  async deleteLoopGroupSubquestionsByLoopId(loopQuestionId: string): Promise<void> {
    await questionRepository.deleteSubquestionsByLoopId(loopQuestionId);
  }

  // Conditional rules operations
  async createConditionalRule(rule: InsertConditionalRule): Promise<ConditionalRule> {
    return await questionRepository.createConditionalRule(rule);
  }

  async getConditionalRule(id: string): Promise<ConditionalRule | undefined> {
    return await questionRepository.findConditionalRuleById(id);
  }

  async getConditionalRulesBySurvey(surveyId: string): Promise<ConditionalRule[]> {
    return await questionRepository.findConditionalRulesBySurvey(surveyId);
  }

  async getConditionalRulesByQuestion(questionId: string): Promise<ConditionalRule[]> {
    return await questionRepository.findConditionalRulesByQuestion(questionId);
  }

  async updateConditionalRule(id: string, updates: Partial<InsertConditionalRule>): Promise<ConditionalRule> {
    return await questionRepository.updateConditionalRule(id, updates);
  }

  async deleteConditionalRule(id: string): Promise<void> {
    await questionRepository.deleteConditionalRule(id);
  }

  async deleteConditionalRulesBySurvey(surveyId: string): Promise<void> {
    await questionRepository.deleteConditionalRulesBySurvey(surveyId);
  }
  
  // Response operations
  async createResponse(response: InsertResponse): Promise<Response> {
    return await responseRepository.create(response);
  }

  async getResponse(id: string): Promise<Response | undefined> {
    return await responseRepository.findById(id);
  }

  async getResponsesBySurvey(surveyId: string): Promise<Response[]> {
    return await responseRepository.findBySurvey(surveyId);
  }

  async updateResponse(id: string, updates: Partial<InsertResponse>): Promise<Response> {
    return await responseRepository.update(id, updates);
  }

  // Answer operations
  async createAnswer(answer: InsertAnswer): Promise<Answer> {
    return await responseRepository.createAnswer(answer);
  }

  async getAnswer(id: string): Promise<Answer | undefined> {
    return await responseRepository.findAnswerById(id);
  }

  async getAnswersByResponse(responseId: string): Promise<Answer[]> {
    return await responseRepository.findAnswersByResponse(responseId);
  }

  async getAnswersWithQuestionsByResponse(responseId: string): Promise<(Answer & { question: Question })[]> {
    return await responseRepository.findAnswersWithQuestionsByResponse(responseId);
  }

  async updateAnswer(id: string, updates: Partial<InsertAnswer>): Promise<Answer> {
    return await responseRepository.updateAnswer(id, updates);
  }
  
  // Analytics operations
  async createAnalyticsEvent(event: Omit<AnalyticsEvent, 'id' | 'timestamp'>): Promise<AnalyticsEvent> {
    return await analyticsRepository.createEvent(event as any);
  }

  async getAnalyticsByResponse(responseId: string): Promise<AnalyticsEvent[]> {
    return await analyticsRepository.findByResponse(responseId);
  }

  async getAnalyticsBySurvey(surveyId: string): Promise<AnalyticsEvent[]> {
    return await analyticsRepository.findBySurvey(surveyId);
  }
  
  // Enhanced dashboard analytics
  async getDashboardStats(creatorId: string): Promise<DashboardStats> {
    const [totalSurveysResult] = await db
      .select({ count: count() })
      .from(surveys)
      .where(eq(surveys.creatorId, creatorId));

    const [activeSurveysResult] = await db
      .select({ count: count() })
      .from(surveys)
      .where(and(eq(surveys.creatorId, creatorId), eq(surveys.status, 'open')));

    const [draftSurveysResult] = await db
      .select({ count: count() })
      .from(surveys)
      .where(and(eq(surveys.creatorId, creatorId), eq(surveys.status, 'draft')));

    const [closedSurveysResult] = await db
      .select({ count: count() })
      .from(surveys)
      .where(and(eq(surveys.creatorId, creatorId), eq(surveys.status, 'closed')));

    const [totalResponsesResult] = await db
      .select({ count: count() })
      .from(responses)
      .leftJoin(surveys, eq(responses.surveyId, surveys.id))
      .where(eq(surveys.creatorId, creatorId));

    const [completedResponsesResult] = await db
      .select({ count: count() })
      .from(responses)
      .leftJoin(surveys, eq(responses.surveyId, surveys.id))
      .where(and(eq(surveys.creatorId, creatorId), eq(responses.completed, true)));

    const totalSurveys = totalSurveysResult.count;
    const totalResponses = totalResponsesResult.count;
    const completedResponses = completedResponsesResult.count;
    const completionRate = totalResponses > 0 ? Math.round((completedResponses / totalResponses) * 100) : 0;
    const avgResponsesPerSurvey = totalSurveys > 0 ? Math.round((totalResponses / totalSurveys) * 10) / 10 : 0;

    // Get recent activity
    const recentActivity = await this.getRecentActivity(creatorId, 5);

    return {
      totalSurveys,
      activeSurveys: activeSurveysResult.count,
      draftSurveys: draftSurveysResult.count,
      closedSurveys: closedSurveysResult.count,
      totalResponses,
      completionRate,
      avgResponsesPerSurvey,
      recentActivity,
    };
  }

  async getSurveyAnalytics(creatorId: string): Promise<SurveyAnalytics[]> {
    const surveysData = await db
      .select({
        surveyId: surveys.id,
        title: surveys.title,
        status: surveys.status,
      })
      .from(surveys)
      .where(eq(surveys.creatorId, creatorId))
      .orderBy(desc(surveys.updatedAt));

    const analytics: SurveyAnalytics[] = [];

    for (const survey of surveysData) {
      const [responseCountResult] = await db
        .select({ count: count() })
        .from(responses)
        .where(eq(responses.surveyId, survey.surveyId));

      const [completedCountResult] = await db
        .select({ count: count() })
        .from(responses)
        .where(and(eq(responses.surveyId, survey.surveyId), eq(responses.completed, true)));

      const [lastResponseResult] = await db
        .select({ submittedAt: responses.submittedAt })
        .from(responses)
        .where(eq(responses.surveyId, survey.surveyId))
        .orderBy(desc(responses.submittedAt))
        .limit(1);

      const responseCount = responseCountResult.count;
      const completedCount = completedCountResult.count;
      const completionRate = responseCount > 0 ? Math.round((completedCount / responseCount) * 100) : 0;

      // Calculate actual completion time data
      const timeSpentData = await this.getTimeSpentData(survey.surveyId);
      const completedTimeData = timeSpentData.filter(data => {
        // Check if response was completed by looking for survey_complete events
        return data.totalTime > 0;
      });
      
      const avgCompletionTime = completedTimeData.length > 0
        ? completedTimeData.reduce((sum, data) => sum + data.totalTime, 0) / completedTimeData.length / 60000 // Convert to minutes
        : 0;
        
      const sortedCompletionTimes = completedTimeData.map(data => data.totalTime).sort((a, b) => a - b);
      const medianCompletionTime = sortedCompletionTimes.length > 0
        ? sortedCompletionTimes[Math.floor(sortedCompletionTimes.length / 2)] / 60000
        : 0;
        
      const totalTimeSpent = completedTimeData.reduce((sum, data) => sum + data.totalTime, 0) / 60000;
      
      // Calculate drop-off rate
      const [totalStartedResult] = await db
        .select({ count: count() })
        .from(analyticsEvents)
        .where(
          and(
            eq(analyticsEvents.surveyId, survey.surveyId),
            eq(analyticsEvents.event, 'survey_start')
          )
        );
        
      const dropOffRate = totalStartedResult.count > 0
        ? Math.round(((totalStartedResult.count - completedCount) / totalStartedResult.count) * 100)
        : 0;
        
      // Find most and least answered questions
      const questionAnalytics = await this.getQuestionAnalytics(survey.surveyId);
      const mostAnswered = questionAnalytics.reduce((max, q) => q.totalAnswers > max.totalAnswers ? q : max, questionAnalytics[0] || { totalAnswers: 0, questionId: undefined });
      const leastAnswered = questionAnalytics.reduce((min, q) => q.totalAnswers < min.totalAnswers ? q : min, questionAnalytics[0] || { totalAnswers: Infinity, questionId: undefined });

      analytics.push({
        surveyId: survey.surveyId,
        title: survey.title,
        responseCount,
        completionRate,
        avgCompletionTime,
        medianCompletionTime,
        totalTimeSpent,
        dropOffRate,
        mostAnsweredQuestionId: mostAnswered?.questionId,
        leastAnsweredQuestionId: leastAnswered?.questionId,
        lastResponseAt: lastResponseResult?.submittedAt || null,
        status: survey.status,
      });
    }

    return analytics;
  }

  async getResponseTrends(creatorId: string, days: number = 30): Promise<ResponseTrend[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const trendsData = await db
      .select({
        date: sql<string>`DATE(${responses.createdAt})`,
        total: count(),
        completed: sql<number>`SUM(CASE WHEN ${responses.completed} THEN 1 ELSE 0 END)`,
      })
      .from(responses)
      .leftJoin(surveys, eq(responses.surveyId, surveys.id))
      .where(and(
        eq(surveys.creatorId, creatorId),
        gte(responses.createdAt, startDate)
      ))
      .groupBy(sql`DATE(${responses.createdAt})`)
      .orderBy(sql`DATE(${responses.createdAt})`);

    // Get time data for each day
    const trendsWithTime: ResponseTrend[] = [];
    
    for (const row of trendsData) {
      // Get time data for responses created on this date
      const dayTimeData = await db
        .select({
          duration: analyticsEvents.duration,
          responseId: analyticsEvents.responseId,
        })
        .from(analyticsEvents)
        .innerJoin(responses, eq(analyticsEvents.responseId, responses.id))
        .innerJoin(surveys, eq(responses.surveyId, surveys.id))
        .where(
          and(
            eq(surveys.creatorId, creatorId),
            sql`DATE(${responses.createdAt}) = ${row.date}`,
            sql`duration IS NOT NULL`,
            eq(analyticsEvents.event, 'survey_complete')
          )
        );
        
      const avgCompletionTime = dayTimeData.length > 0
        ? dayTimeData.reduce((sum: number, event: any) => sum + (event.duration || 0), 0) / dayTimeData.length / 60000
        : 0;

      const totalTimeSpent = dayTimeData.reduce((sum: number, event: any) => sum + (event.duration || 0), 0) / 60000;
      
      trendsWithTime.push({
        date: row.date,
        count: row.total,
        completed: Number(row.completed),
        avgCompletionTime,
        totalTimeSpent,
      });
    }
    
    return trendsWithTime;
  }

  async getRecentActivity(creatorId: string, limit: number = 10): Promise<ActivityItem[]> {
    const activities: ActivityItem[] = [];

    // Recent survey creations/updates
    const recentSurveys = await db
      .select({
        id: surveys.id,
        title: surveys.title,
        status: surveys.status,
        createdAt: surveys.createdAt,
        updatedAt: surveys.updatedAt,
      })
      .from(surveys)
      .where(eq(surveys.creatorId, creatorId))
      .orderBy(desc(surveys.updatedAt))
      .limit(limit);

    for (const survey of recentSurveys) {
      const createdTime = survey.createdAt?.getTime() || 0;
      const updatedTime = survey.updatedAt?.getTime() || 0;
      
      activities.push({
        id: randomUUID(),
        type: createdTime === updatedTime ? 'survey_created' : 'survey_published',
        title: survey.title,
        description: createdTime === updatedTime 
          ? 'Survey was created' 
          : `Survey status changed to ${survey.status}`,
        timestamp: survey.updatedAt || survey.createdAt || new Date(),
        surveyId: survey.id,
      });
    }

    // Recent responses
    const recentResponses = await db
      .select({
        responseId: responses.id,
        surveyId: responses.surveyId,
        surveyTitle: surveys.title,
        submittedAt: responses.submittedAt,
        completed: responses.completed,
      })
      .from(responses)
      .leftJoin(surveys, eq(responses.surveyId, surveys.id))
      .where(eq(surveys.creatorId, creatorId))
      .orderBy(desc(responses.createdAt))
      .limit(limit);

    for (const response of recentResponses) {
      if (response.submittedAt) {
        activities.push({
          id: randomUUID(),
          type: 'response_received',
          title: response.surveyTitle || 'Unknown Survey',
          description: response.completed ? 'Response completed' : 'Response received',
          timestamp: response.submittedAt,
          surveyId: response.surveyId,
          responseId: response.responseId,
        });
      }
    }

    // Sort all activities by timestamp and return limited results
    return activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  // Advanced analytics methods
  async getQuestionAnalytics(surveyId: string): Promise<QuestionAnalytics[]> {
    // Count total responses for this survey
    const [totalResponsesResult] = await db
      .select({ count: count() })
      .from(responses)
      .where(eq(responses.surveyId, surveyId));

    const totalResponses = totalResponsesResult.count;

    // Get all questions for this survey
    const surveyQuestions = await db
      .select({
        questionId: questions.id,
        questionTitle: questions.title,
        questionType: questions.type,
        pageId: questions.pageId,
      })
      .from(questions)
      .innerJoin(surveyPages, eq(questions.pageId, surveyPages.id))
      .where(eq(surveyPages.surveyId, surveyId));

    // Get aggregates from analyticsRepository for all questions
    const { analyticsRepository } = await import('./repositories');
    const aggregatesData = await analyticsRepository.getQuestionAggregates(surveyId);

    const analytics: QuestionAnalytics[] = [];

    for (const question of surveyQuestions) {
      // Count views (question_focus events)
      const [viewsResult] = await db
        .select({ count: count() })
        .from(analyticsEvents)
        .where(
          and(
            eq(analyticsEvents.surveyId, surveyId),
            eq(analyticsEvents.questionId, question.questionId),
            eq(analyticsEvents.event, 'question_focus')
          )
        );

      // Count answers from analytics events
      const [analyticsAnswersResult] = await db
        .select({ count: count() })
        .from(analyticsEvents)
        .where(
          and(
            eq(analyticsEvents.surveyId, surveyId),
            eq(analyticsEvents.questionId, question.questionId),
            eq(analyticsEvents.event, 'question_answer')
          )
        );

      // Count actual answers from answers table (fallback if analytics events don't exist)
      const [actualAnswersResult] = await db
        .select({ count: count() })
        .from(answers)
        .innerJoin(responses, eq(answers.responseId, responses.id))
        .where(
          and(
            eq(responses.surveyId, surveyId),
            eq(answers.questionId, question.questionId)
          )
        );

      // Count skips
      const [skipsResult] = await db
        .select({ count: count() })
        .from(analyticsEvents)
        .where(
          and(
            eq(analyticsEvents.surveyId, surveyId),
            eq(analyticsEvents.questionId, question.questionId),
            eq(analyticsEvents.event, 'question_skip')
          )
        );

      // Calculate average time spent
      const timeEvents = await db
        .select({ duration: analyticsEvents.duration })
        .from(analyticsEvents)
        .where(
          and(
            eq(analyticsEvents.surveyId, surveyId),
            eq(analyticsEvents.questionId, question.questionId),
            sql`duration IS NOT NULL`
          )
        );

      // Use actual answers from database if analytics events don't exist
      const totalAnswers = Math.max(analyticsAnswersResult.count, actualAnswersResult.count);
      const totalViews = viewsResult.count || totalAnswers; // Use answer count as views if no focus events
      const totalSkips = skipsResult.count;

      const avgTimeSpent = timeEvents.length > 0
        ? timeEvents.reduce((sum: number, event: any) => sum + (event.duration || 0), 0) / timeEvents.length / 1000
        : 0;

      const sortedTimes = timeEvents.map((e: any) => e.duration || 0).sort((a: number, b: number) => a - b);
      const medianTimeSpent = sortedTimes.length > 0
        ? sortedTimes[Math.floor(sortedTimes.length / 2)] / 1000
        : 0;

      // Get aggregates for this question
      const questionAggregateData = aggregatesData[question.questionId];
      const aggregation = questionAggregateData?.aggregation;

      // Transform aggregates to frontend format
      let aggregates: Array<{ option: string; count: number; percentage: number }> | undefined;
      let textAnswers: string[] | undefined;

      if (aggregation) {
        if (question.questionType === 'yes_no') {
          // Transform yes/no object to array format
          aggregates = [
            { option: 'Yes', count: aggregation.yes || 0, percentage: totalAnswers > 0 ? Math.round((aggregation.yes / totalAnswers) * 100) : 0 },
            { option: 'No', count: aggregation.no || 0, percentage: totalAnswers > 0 ? Math.round((aggregation.no / totalAnswers) * 100) : 0 }
          ];
        } else if (question.questionType === 'multiple_choice' || question.questionType === 'radio' || question.questionType === 'short_text') {
          // Already in array format from repository, just rename 'percent' to 'percentage'
          // short_text now uses grouped aggregates with case-insensitive grouping
          aggregates = aggregation.map((item: any) => ({
            option: item.option,
            count: item.count,
            percentage: item.percent
          }));
        } else if (question.questionType === 'long_text') {
          // For long_text, show raw text responses (usually unique)
          // But also provide aggregates if there's any clustering
          if (Array.isArray(aggregation) && aggregation.length > 0) {
            aggregates = aggregation.map((item: any) => ({
              option: item.option,
              count: item.count,
              percentage: item.percent
            }));
          }

          // Also get raw text for display
          const textAnswersData = await db
            .select({ value: answers.value })
            .from(answers)
            .innerJoin(responses, eq(answers.responseId, responses.id))
            .where(
              and(
                eq(responses.surveyId, surveyId),
                eq(answers.questionId, question.questionId)
              )
            );

          textAnswers = textAnswersData
            .map((a: { value: any }) => {
              const value = a.value;
              if (typeof value === 'string') return value;
              if (typeof value === 'object' && value !== null) {
                return (value as any).text || String(value);
              }
              return String(value);
            })
            .filter((text: string) => text && text.trim().length > 0);
        } else if (question.questionType === 'date_time') {
          // For date_time, show aggregated date/time values
          if (Array.isArray(aggregation) && aggregation.length > 0) {
            aggregates = aggregation.map((item: any) => ({
              option: item.option,
              count: item.count,
              percentage: item.percent
            }));
          }
        }
      }

      analytics.push({
        questionId: question.questionId,
        questionTitle: question.questionTitle,
        questionType: question.questionType,
        pageId: question.pageId,
        totalResponses,
        totalViews,
        totalAnswers,
        totalSkips,
        answerRate: totalViews > 0 ? Math.round((totalAnswers / totalViews) * 100) : 0,
        avgTimeSpent,
        medianTimeSpent,
        dropOffCount: totalViews - totalAnswers - totalSkips,
        aggregates,
        textAnswers,
      });
    }

    return analytics;
  }

  async getPageAnalytics(surveyId: string): Promise<PageAnalytics[]> {
    // Get all pages for this survey
    const pages = await db
      .select({
        pageId: surveyPages.id,
        pageTitle: surveyPages.title,
        pageOrder: surveyPages.order,
      })
      .from(surveyPages)
      .where(eq(surveyPages.surveyId, surveyId))
      .orderBy(surveyPages.order);

    const analytics: PageAnalytics[] = [];

    for (const page of pages) {
      // Count page views
      const [viewsResult] = await db
        .select({ count: count() })
        .from(analyticsEvents)
        .where(
          and(
            eq(analyticsEvents.surveyId, surveyId),
            eq(analyticsEvents.pageId, page.pageId),
            eq(analyticsEvents.event, 'page_view')
          )
        );

      // Count page completions (page_leave events)
      const [completionsResult] = await db
        .select({ count: count() })
        .from(analyticsEvents)
        .where(
          and(
            eq(analyticsEvents.surveyId, surveyId),
            eq(analyticsEvents.pageId, page.pageId),
            eq(analyticsEvents.event, 'page_leave')
          )
        );

      // Calculate average time spent on page
      const pageTimeEvents = await db
        .select({ duration: analyticsEvents.duration })
        .from(analyticsEvents)
        .where(
          and(
            eq(analyticsEvents.surveyId, surveyId),
            eq(analyticsEvents.pageId, page.pageId),
            eq(analyticsEvents.event, 'page_leave'),
            sql`duration IS NOT NULL`
          )
        );

      const totalViews = viewsResult.count;
      const totalCompletions = completionsResult.count;
      const avgTimeSpent = pageTimeEvents.length > 0
        ? pageTimeEvents.reduce((sum: number, event: any) => sum + (event.duration || 0), 0) / pageTimeEvents.length / 1000
        : 0;

      const sortedTimes = pageTimeEvents.map((e: any) => e.duration || 0).sort((a: number, b: number) => a - b);
      const medianTimeSpent = sortedTimes.length > 0
        ? sortedTimes[Math.floor(sortedTimes.length / 2)] / 1000
        : 0;

      // Get question analytics for this page
      const questionAnalytics = await this.getQuestionAnalytics(surveyId);
      const pageQuestions = questionAnalytics.filter(q => q.pageId === page.pageId);

      analytics.push({
        pageId: page.pageId,
        pageTitle: page.pageTitle,
        pageOrder: page.pageOrder,
        totalViews,
        totalCompletions,
        completionRate: totalViews > 0 ? Math.round((totalCompletions / totalViews) * 100) : 0,
        avgTimeSpent,
        medianTimeSpent,
        dropOffCount: totalViews - totalCompletions,
        questions: pageQuestions,
      });
    }

    return analytics;
  }

  async getCompletionFunnelData(surveyId: string): Promise<CompletionFunnelData[]> {
    const pageAnalytics = await this.getPageAnalytics(surveyId);
    
    return pageAnalytics.map(page => ({
      pageId: page.pageId,
      pageTitle: page.pageTitle,
      pageOrder: page.pageOrder,
      entrances: page.totalViews,
      exits: page.dropOffCount,
      completions: page.totalCompletions,
      dropOffRate: page.totalViews > 0 ? Math.round((page.dropOffCount / page.totalViews) * 100) : 0,
    }));
  }

  async getTimeSpentData(surveyId: string): Promise<TimeSpentData[]> {
    // Get all responses for this survey
    const surveyResponses = await db
      .select({ responseId: responses.id })
      .from(responses)
      .where(eq(responses.surveyId, surveyId));

    const timeSpentData: TimeSpentData[] = [];

    for (const response of surveyResponses) {
      // Get all time-based events for this response
      const events = await db
        .select({
          pageId: analyticsEvents.pageId,
          questionId: analyticsEvents.questionId,
          duration: analyticsEvents.duration,
          event: analyticsEvents.event,
        })
        .from(analyticsEvents)
        .where(
          and(
            eq(analyticsEvents.responseId, response.responseId),
            sql`duration IS NOT NULL`
          )
        );

      const totalTime = events.reduce((sum: number, event: any) => sum + (event.duration || 0), 0);

      const pageTimeSpent = events
        .filter((e: any) => e.pageId && e.event === 'page_leave')
        .map((e: any) => ({ pageId: e.pageId!, duration: e.duration || 0 }));

      const questionTimeSpent = events
        .filter((e: any) => e.questionId && (e.event === 'question_answer' || e.event === 'question_skip'))
        .map((e: any) => ({ questionId: e.questionId!, duration: e.duration || 0 }));

      timeSpentData.push({
        surveyId,
        responseId: response.responseId,
        totalTime,
        pageTimeSpent,
        questionTimeSpent,
      });
    }

    return timeSpentData;
  }

  async getEngagementMetrics(surveyId: string): Promise<EngagementMetrics> {
    const timeSpentData = await this.getTimeSpentData(surveyId);
    
    // Calculate average session duration
    const avgSessionDuration = timeSpentData.length > 0
      ? timeSpentData.reduce((sum, data) => sum + data.totalTime, 0) / timeSpentData.length / 60000 // Convert to minutes
      : 0;

    // Calculate bounce rate (responses with no answers)
    const [totalResponsesResult] = await db
      .select({ count: count() })
      .from(responses)
      .where(eq(responses.surveyId, surveyId));

    const uniqueAnsweredResponses = await db
      .select({ responseId: analyticsEvents.responseId })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.surveyId, surveyId),
          eq(analyticsEvents.event, 'question_answer')
        )
      )
      .groupBy(analyticsEvents.responseId);

    const bounceRate = totalResponsesResult.count > 0
      ? Math.round(((totalResponsesResult.count - uniqueAnsweredResponses.length) / totalResponsesResult.count) * 100)
      : 0;

    // Calculate engagement score (simplified)
    const engagementScore = Math.max(0, Math.min(100, Math.round(100 - bounceRate + (avgSessionDuration * 10))));

    // Get completion trends by hour
    const completionTrends = await db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM timestamp)`,
        completions: count(),
      })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.surveyId, surveyId),
          eq(analyticsEvents.event, 'survey_complete')
        )
      )
      .groupBy(sql`EXTRACT(HOUR FROM timestamp)`);

    const peakEngagementHour = completionTrends.length > 0
      ? completionTrends.reduce((max: any, current: any) => current.completions > max.completions ? current : max).hour
      : 12; // Default to noon

    return {
      surveyId,
      avgSessionDuration,
      bounceRate,
      engagementScore,
      peakEngagementHour,
      completionTrends: completionTrends.map((trend: any) => ({ hour: trend.hour, completions: trend.completions })),
    };
  }

  // Bulk operations
  async bulkUpdateSurveyStatus(surveyIds: string[], status: string, creatorId: string): Promise<BulkOperationResult> {
    try {
      // Verify all surveys belong to the creator
      const foundSurveys = await db
        .select({ id: surveys.id })
        .from(surveys)
        .where(and(
          inArray(surveys.id, surveyIds),
          eq(surveys.creatorId, creatorId)
        ));

      if (foundSurveys.length !== surveyIds.length) {
        return {
          success: false,
          updatedCount: 0,
          errors: ['Some surveys not found or access denied'],
        };
      }

      // Update survey statuses
      await db
        .update(surveys)
        .set({ 
          status: status as any,
          updatedAt: new Date(),
        })
        .where(and(
          inArray(surveys.id, surveyIds),
          eq(surveys.creatorId, creatorId)
        ));

      return {
        success: true,
        updatedCount: foundSurveys.length,
        errors: [],
      };
    } catch (error) {
      return {
        success: false,
        updatedCount: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  async bulkDeleteSurveys(surveyIds: string[], creatorId: string): Promise<BulkOperationResult> {
    try {
      // Verify all surveys belong to the creator
      const surveysToDelete = await db
        .select({ id: surveys.id })
        .from(surveys)
        .where(and(
          inArray(surveys.id, surveyIds),
          eq(surveys.creatorId, creatorId)
        ));

      if (surveysToDelete.length !== surveyIds.length) {
        return {
          success: false,
          updatedCount: 0,
          errors: ['Some surveys not found or access denied'],
        };
      }

      // Delete surveys (cascade deletes will handle related data)
      await db
        .delete(surveys)
        .where(and(
          inArray(surveys.id, surveyIds),
          eq(surveys.creatorId, creatorId)
        ));

      return {
        success: true,
        updatedCount: surveysToDelete.length,
        errors: [],
      };
    } catch (error) {
      return {
        success: false,
        updatedCount: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  // Survey management
  async duplicateSurvey(surveyId: string, newTitle: string, creatorId: string): Promise<Survey> {
    const originalSurvey = await db
      .select()
      .from(surveys)
      .where(and(eq(surveys.id, surveyId), eq(surveys.creatorId, creatorId)))
      .limit(1);

    if (!originalSurvey.length) {
      throw new Error('Survey not found or access denied');
    }

    const original = originalSurvey[0];

    // Create new survey
    const [newSurvey] = await db
      .insert(surveys)
      .values({
        title: newTitle,
        description: original.description,
        creatorId,
        status: 'draft',
      })
      .returning();

    // Duplicate pages and questions
    const pages = await db
      .select()
      .from(surveyPages)
      .where(eq(surveyPages.surveyId, surveyId))
      .orderBy(surveyPages.order);

    for (const page of pages) {
      const [newPage] = await db
        .insert(surveyPages)
        .values({
          surveyId: newSurvey.id,
          title: page.title,
          order: page.order,
        })
        .returning();

      const pageQuestions = await db
        .select()
        .from(questions)
        .where(eq(questions.pageId, page.id))
        .orderBy(questions.order);

      for (const question of pageQuestions) {
        await db
          .insert(questions)
          .values({
            pageId: newPage.id,
            type: question.type,
            title: question.title,
            description: question.description,
            required: question.required,
            options: question.options,
            order: question.order,
          });
      }
    }

    return newSurvey;
  }

  async archiveSurvey(surveyId: string, creatorId: string): Promise<Survey> {
    const [archivedSurvey] = await db
      .update(surveys)
      .set({ 
        status: 'closed',
        updatedAt: new Date(),
      })
      .where(and(eq(surveys.id, surveyId), eq(surveys.creatorId, creatorId)))
      .returning();

    if (!archivedSurvey) {
      throw new Error('Survey not found or access denied');
    }

    return archivedSurvey;
  }

  // File operations
  async createFile(fileData: {
    answerId: string;
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
  }): Promise<FileMetadata> {
    const newFile = await fileRepository.create(fileData);
    return {
      id: newFile.id,
      answerId: newFile.answerId,
      filename: newFile.filename,
      originalName: newFile.originalName,
      mimeType: newFile.mimeType,
      size: newFile.size,
      uploadedAt: newFile.uploadedAt!
    };
  }

  async getFile(id: string): Promise<FileMetadata | undefined> {
    const file = await fileRepository.findById(id);
    if (!file) return undefined;

    return {
      id: file.id,
      answerId: file.answerId,
      filename: file.filename,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      uploadedAt: file.uploadedAt!
    };
  }

  async getFilesByAnswer(answerId: string): Promise<FileMetadata[]> {
    const fileList = await fileRepository.findByAnswer(answerId);
    return fileList.map((file) => ({
      id: file.id,
      answerId: file.answerId,
      filename: file.filename,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      uploadedAt: file.uploadedAt!
    }));
  }

  async deleteFile(id: string): Promise<void> {
    await fileRepository.delete(id);
  }

  async deleteFilesByAnswer(answerId: string): Promise<void> {
    await fileRepository.deleteByAnswer(answerId);
  }

  // Anonymous survey operations
  async getSurveyByPublicLink(publicLink: string): Promise<Survey | undefined> {
    logger.debug({ publicLink }, 'Looking up survey by public link in database');

    try {
      const [survey] = await db.select().from(surveys).where(eq(surveys.publicLink, publicLink));

      if (survey) {
        logger.debug({
          id: survey.id,
          title: survey.title,
          publicLink: survey.publicLink,
          allowAnonymous: survey.allowAnonymous,
          status: survey.status
        }, 'Found survey by public link');
      } else {
        logger.debug({ publicLink }, 'No survey found for public link');

        // Debug: Let's see what surveys exist with public links
        const allSurveysWithPublicLinks = await db
          .select({ id: surveys.id, title: surveys.title, publicLink: surveys.publicLink })
          .from(surveys)
          .where(sql`${surveys.publicLink} IS NOT NULL`);

        logger.debug({ allSurveysWithPublicLinks }, 'All surveys with public links');
      }

      return survey;
    } catch (error) {
      logger.error({ error, publicLink }, 'Database error looking up survey by public link');
      throw error;
    }
  }

  async generatePublicLink(surveyId: string): Promise<string> {
    const publicLink = randomUUID();
    await db
      .update(surveys)
      .set({ 
        publicLink,
        updatedAt: new Date()
      })
      .where(eq(surveys.id, surveyId));
    return publicLink;
  }

  async enableAnonymousAccess(surveyId: string, config: { accessType: string; anonymousConfig?: AnonymousSurveyConfig }): Promise<Survey> {
    logger.debug({ surveyId }, 'Enabling anonymous access in database for survey');

    return await db.transaction(async (tx: DbTransaction) => {
      // First verify the survey exists within transaction
      const [existingSurvey] = await tx.select().from(surveys).where(eq(surveys.id, surveyId));
      if (!existingSurvey) {
        logger.error({ surveyId }, 'Survey not found when enabling anonymous access');
        throw new Error('Survey not found - cannot enable anonymous access');
      }

      logger.debug({
        id: existingSurvey.id,
        title: existingSurvey.title,
        currentStatus: existingSurvey.status,
        hasExistingPublicLink: !!existingSurvey.publicLink,
        allowAnonymous: existingSurvey.allowAnonymous
      }, 'Survey exists, proceeding with anonymous access enablement');

      // Check if anonymous access is already enabled with a public link (idempotent behavior)
      if (existingSurvey.allowAnonymous && existingSurvey.publicLink) {
        logger.debug({
          existingPublicLink: existingSurvey.publicLink,
          currentAccessType: existingSurvey.anonymousAccessType,
          newAccessType: config.accessType
        }, 'Anonymous access already enabled, updating configuration only');

        // Update only the configuration without regenerating the public link
        const [updatedSurvey] = await tx
          .update(surveys)
          .set({
            anonymousAccessType: config.accessType as any,
            anonymousConfig: config.anonymousConfig ? JSON.stringify(config.anonymousConfig) : null,
            updatedAt: new Date()
          })
          .where(eq(surveys.id, surveyId))
          .returning();

        if (!updatedSurvey) {
          logger.error('No survey returned after configuration update');
          throw new Error('Survey configuration update failed');
        }

        logger.debug({
          id: updatedSurvey.id,
          publicLink: updatedSurvey.publicLink, // Unchanged
          anonymousAccessType: updatedSurvey.anonymousAccessType,
          status: updatedSurvey.status
        }, 'Anonymous access configuration updated (idempotent)');
        
        return updatedSurvey;
      }

      // Auto-publish draft surveys when enabling anonymous access (only from draft → open)
      const shouldPublish = existingSurvey.status === 'draft';
      if (shouldPublish) {
        logger.debug('Auto-publishing draft survey for anonymous access');
      }

      // Generate new public link only if one doesn't exist
      const publicLink = existingSurvey.publicLink || randomUUID();
      logger.debug({
        isNew: !existingSurvey.publicLink,
        publicLink: publicLink
      }, 'Using public link');

      try {
        const [updatedSurvey] = await tx
          .update(surveys)
          .set({
            allowAnonymous: true,
            anonymousAccessType: config.accessType as any,
            publicLink,
            status: shouldPublish ? 'open' : existingSurvey.status, // Auto-publish drafts only
            anonymousConfig: config.anonymousConfig ? JSON.stringify(config.anonymousConfig) : null,
            updatedAt: new Date()
          })
          .where(eq(surveys.id, surveyId))
          .returning();

        if (!updatedSurvey) {
          logger.error('No survey returned after update operation');
          throw new Error('Survey update failed - no result returned');
        }

        logger.info({
          id: updatedSurvey.id,
          publicLink: updatedSurvey.publicLink,
          allowAnonymous: updatedSurvey.allowAnonymous,
          anonymousAccessType: updatedSurvey.anonymousAccessType,
          status: updatedSurvey.status,
          autoPublished: shouldPublish,
          wasIdempotent: !!existingSurvey.publicLink
        }, 'Survey updated with anonymous access');

        // Verify the survey can be found by public link within the transaction
        const [verification] = await tx.select().from(surveys).where(eq(surveys.publicLink, updatedSurvey.publicLink || ''));
        if (!verification) {
          logger.error({ publicLink: updatedSurvey.publicLink }, 'CRITICAL: Survey not found by public link immediately after creation!');
          throw new Error('Anonymous access enablement failed - survey not findable by public link');
        }

        logger.debug('Anonymous access enablement verified successfully within transaction');
        return updatedSurvey;
      } catch (error) {
        logger.error({ error }, 'Database error enabling anonymous access');
        throw error;
      }
    });
  }

  async disableAnonymousAccess(surveyId: string): Promise<Survey> {
    const [updatedSurvey] = await db
      .update(surveys)
      .set({
        allowAnonymous: false,
        anonymousAccessType: 'disabled',
        publicLink: null,
        anonymousConfig: null,
        updatedAt: new Date()
      })
      .where(eq(surveys.id, surveyId))
      .returning();
    
    if (!updatedSurvey) {
      throw new Error('Survey not found');
    }
    
    return updatedSurvey;
  }

  async createAnonymousResponse(data: {
    surveyId: string;
    ipAddress: string;
    userAgent?: string;
    sessionId?: string;
    anonymousMetadata?: any;
  }): Promise<Response> {
    return await responseRepository.createAnonymousResponse(data);
  }

  async checkAnonymousResponseLimit(surveyId: string, ipAddress: string, sessionId?: string): Promise<boolean> {
    // Get survey configuration first
    const survey = await this.getSurvey(surveyId);
    if (!survey || !survey.allowAnonymous) {
      return false; // Survey doesn't allow anonymous responses
    }

    const accessType = survey.anonymousAccessType || 'disabled';
    return await responseRepository.checkAnonymousLimit(surveyId, ipAddress, sessionId, accessType);
  }

  async createAnonymousResponseTracking(tracking: InsertAnonymousResponseTracking): Promise<AnonymousResponseTracking> {
    return await responseRepository.createAnonymousTracking(tracking);
  }

  async getAnonymousResponsesBySurvey(surveyId: string): Promise<Response[]> {
    return await responseRepository.findAnonymousBySurvey(surveyId);
  }

  async getAnonymousResponseCount(surveyId: string): Promise<number> {
    return await responseRepository.countAnonymousBySurvey(surveyId);
  }
}

export const storage = new DatabaseStorage();
