// DEPRECATED: Legacy survey template insertion service
// Disabled as part of survey system removal (Nov 2025)
// This functionality is no longer used with the workflow-based system

// import { db } from "../db";
// import { PageRepository } from "../repositories/PageRepository";
// import { QuestionRepository } from "../repositories/QuestionRepository";
// import { TemplateRepository } from "../repositories/TemplateRepository";
// import { SurveyRepository } from "../repositories/SurveyRepository";
// import { surveyPages, questions } from "@shared/schema";
// import { eq, max } from "drizzle-orm";
// import type { SurveyTemplate } from "@shared/schema";

export class TemplateInsertionService {
  // Service disabled - legacy survey functionality
  // pageRepo = new PageRepository();
  // questionRepo = new QuestionRepository();
  // templateRepo = new TemplateRepository();
  // surveyRepo = new SurveyRepository();

  /**
   * Insert a template into an existing survey
   * Copies all pages and questions from the template, preserving structure but generating new IDs
   */
  async insertTemplateIntoSurvey(
    templateId: string,
    surveyId: string,
    creatorId: string
  ): Promise<{
    pagesAdded: number;
    questionsAdded: number;
    templateName: string;
  }> {
    // Get template
    const template = await this.templateRepo.findById(templateId);
    if (!template) {
      throw new Error("Template not found");
    }

    // Verify access: user's own template or system template
    if (template.creatorId !== creatorId && !template.isSystem) {
      throw new Error("Access denied to template");
    }

    // Verify survey ownership
    const survey = await this.surveyRepo.findById(surveyId);
    if (!survey) {
      throw new Error("Survey not found");
    }
    if (survey.creatorId !== creatorId) {
      throw new Error("Access denied to survey");
    }

    // Get template content
    const content = template.content as {
      survey: { title: string; description?: string };
      pages: Array<{
        id: string;
        title: string;
        order: number;
        questions: Array<{
          id: string;
          type: string;
          title: string;
          description?: string;
          required?: boolean;
          options?: any;
          loopConfig?: any;
          order: number;
          subquestions?: Array<{
            id: string;
            type: string;
            title: string;
            description?: string;
            required?: boolean;
            options?: any;
            loopConfig?: any;
            order: number;
          }>;
        }>;
      }>;
    };

    if (!content.pages || !Array.isArray(content.pages)) {
      throw new Error("Invalid template content structure");
    }

    // Use transaction to ensure atomicity
    return await db.transaction(async (tx: any) => {
      // Get current max page order for the survey
      const [result] = await tx
        .select({ maxOrder: max(surveyPages.order) })
        .from(surveyPages)
        .where(eq(surveyPages.surveyId, surveyId));

      let currentPageOrder = (result?.maxOrder ?? 0);

      const pageIdMap = new Map<string, string>();
      let totalQuestionsAdded = 0;

      // Insert all pages from template
      for (const templatePage of content.pages) {
        currentPageOrder++;

        // Create new page
        const [newPage] = await tx
          .insert(surveyPages)
          .values({
            surveyId,
            title: templatePage.title,
            order: currentPageOrder,
          } as any)
          .returning();

        // Map old page ID to new page ID
        pageIdMap.set(templatePage.id, newPage.id);

        // Insert all questions for this page
        for (const templateQuestion of templatePage.questions || []) {
          // Create new question
          const [newQuestion] = await tx
            .insert(questions)
            .values({
              pageId: newPage.id,
              type: templateQuestion.type,
              title: templateQuestion.title,
              description: templateQuestion.description || null,
              required: templateQuestion.required || false,
              options: templateQuestion.options || null,
              loopConfig: templateQuestion.loopConfig || null,
              order: templateQuestion.order,
            } as any)
            .returning();

          totalQuestionsAdded++;

          // Handle loop group subquestions
          if (
            templateQuestion.type === "loop_group" &&
            templateQuestion.subquestions &&
            Array.isArray(templateQuestion.subquestions)
          ) {
            const { loopGroupSubquestions } = await import("@shared/schema");

            for (const subq of templateQuestion.subquestions) {
              await tx.insert(loopGroupSubquestions).values({
                loopQuestionId: newQuestion.id,
                type: subq.type,
                title: subq.title,
                description: subq.description || null,
                required: subq.required || false,
                options: subq.options || null,
                loopConfig: subq.loopConfig || null,
                order: subq.order,
              } as any);
            }
          }
        }
      }

      return {
        pagesAdded: content.pages.length,
        questionsAdded: totalQuestionsAdded,
        templateName: template.name,
      };
    });
  }
}

export const templateInsertionService = new TemplateInsertionService();
