/**
 * Service Layer Index
 * Central export point for all business logic services
 *
 * Services provide a clean abstraction layer between routes and repositories,
 * handling business logic, validation, authorization, and orchestration.
 */

// Export services
export { SurveyService, surveyService } from "./SurveyService";
export { ResponseService, responseService } from "./ResponseService";
export { AnalyticsService, analyticsService } from "./AnalyticsService";

// Vault-Logic Workflow services
export { ProjectService, projectService } from "./ProjectService";
export { WorkflowService, workflowService } from "./WorkflowService";

// Stage 14: Review & E-Signature services
export { ReviewTaskService, reviewTaskService } from "./ReviewTaskService";
export { SignatureRequestService, signatureRequestService } from "./SignatureRequestService";

// Export existing utility services
// Note: Not re-exporting emailService and sendgrid to avoid conflicts
export * from "./exportService";
export * from "./fileService";
export * from "./surveyValidation";
