import { reviewTaskRepository, workflowRepository, projectRepository } from "../repositories";
import type { ReviewTask, InsertReviewTask } from "@shared/schema";
import { createError } from "../utils/errors";
import { aclService as defaultAclService } from "./AclService";

/**
 * Service layer for review task-related business logic
 * Stage 14: E-Signature Node + Document Review Portal
 */
export class ReviewTaskService {
  private reviewTaskRepo: typeof reviewTaskRepository;
  private workflowRepo: typeof workflowRepository;
  private projectRepo: typeof projectRepository;
  private aclService: typeof defaultAclService;

  constructor(
    reviewTaskRepo?: typeof reviewTaskRepository,
    workflowRepo?: typeof workflowRepository,
    projectRepo?: typeof projectRepository,
    aclService?: typeof defaultAclService
  ) {
    this.reviewTaskRepo = reviewTaskRepo || reviewTaskRepository;
    this.workflowRepo = workflowRepo || workflowRepository;
    this.projectRepo = projectRepo || projectRepository;
    this.aclService = aclService || defaultAclService;
  }

  /**
   * Create a review task
   */
  async createReviewTask(data: InsertReviewTask): Promise<ReviewTask> {
    // Validate workflow exists
    const workflow = await this.workflowRepo.findById(data.workflowId);
    if (!workflow) {
      throw createError.notFound("Workflow not found");
    }

    // Validate project exists
    const project = await this.projectRepo.findById(data.projectId);
    if (!project) {
      throw createError.notFound("Project not found");
    }

    // Create the review task
    const task = await this.reviewTaskRepo.create(data);

    // TODO: Send notification email to reviewer
    // This would integrate with the email service to notify the reviewer

    return task;
  }

  /**
   * Get review task by ID
   * Verifies the user has access to the project
   */
  async getReviewTask(taskId: string, userId: string): Promise<ReviewTask> {
    const task = await this.reviewTaskRepo.findById(taskId);
    if (!task) {
      throw createError.notFound("Review task not found");
    }

    // Verify user has access to the project
    const project = await this.projectRepo.findById(task.projectId);
    if (!project) {
      throw createError.notFound("Project not found");
    }

    // Verify user has at least view access to the project (Dec 2025 - Security fix)
    const hasAccess = await this.aclService.hasProjectRole(userId, task.projectId, 'view');
    if (!hasAccess) {
      throw createError.forbidden("Access denied - insufficient permissions for this project");
    }

    return task;
  }

  /**
   * Get review tasks for a user (as reviewer)
   */
  async getTasksForReviewer(reviewerId: string): Promise<ReviewTask[]> {
    return await this.reviewTaskRepo.findByReviewerId(reviewerId);
  }

  /**
   * Get pending review tasks for a project
   */
  async getPendingTasksByProject(projectId: string, userId: string): Promise<ReviewTask[]> {
    // Verify user has access to the project
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw createError.notFound("Project not found");
    }

    // Verify user has at least view access to the project (Dec 2025 - Security fix)
    const hasAccess = await this.aclService.hasProjectRole(userId, projectId, 'view');
    if (!hasAccess) {
      throw createError.forbidden("Access denied - insufficient permissions for this project");
    }

    return await this.reviewTaskRepo.findPendingByProjectId(projectId);
  }

  /**
   * Approve a review task
   * Returns the updated task
   */
  async approveTask(
    taskId: string,
    userId: string,
    comment?: string
  ): Promise<ReviewTask> {
    const task = await this.getReviewTask(taskId, userId);

    // Only allow approval if task is pending
    if (task.status !== 'pending') {
      throw createError.validation("Task is not pending");
    }

    // Verify user is the designated reviewer (or has admin access)
    if (task.reviewerId && task.reviewerId !== userId) {
      // TODO: Add admin override check
      throw createError.forbidden("You are not the designated reviewer for this task");
    }

    // Update task status
    const updated = await this.reviewTaskRepo.updateStatus(
      taskId,
      'approved',
      comment
    );

    // TODO: Trigger workflow resume
    // This will be handled by the run resume mechanism

    return updated;
  }

  /**
   * Request changes on a review task
   */
  async requestChanges(
    taskId: string,
    userId: string,
    comment: string
  ): Promise<ReviewTask> {
    const task = await this.getReviewTask(taskId, userId);

    // Only allow requesting changes if task is pending
    if (task.status !== 'pending') {
      throw createError.validation("Task is not pending");
    }

    // Verify user is the designated reviewer
    if (task.reviewerId && task.reviewerId !== userId) {
      throw createError.forbidden("You are not the designated reviewer for this task");
    }

    // Comment is required for requesting changes
    if (!comment || comment.trim().length === 0) {
      throw createError.validation("Comment is required when requesting changes");
    }

    // Update task status
    const updated = await this.reviewTaskRepo.updateStatus(
      taskId,
      'changes_requested',
      comment
    );

    // TODO: Send notification to workflow creator

    return updated;
  }

  /**
   * Reject a review task
   */
  async rejectTask(
    taskId: string,
    userId: string,
    comment?: string
  ): Promise<ReviewTask> {
    const task = await this.getReviewTask(taskId, userId);

    // Only allow rejection if task is pending
    if (task.status !== 'pending') {
      throw createError.validation("Task is not pending");
    }

    // Verify user is the designated reviewer
    if (task.reviewerId && task.reviewerId !== userId) {
      throw createError.forbidden("You are not the designated reviewer for this task");
    }

    // Update task status
    const updated = await this.reviewTaskRepo.updateStatus(
      taskId,
      'rejected',
      comment
    );

    // TODO: Mark workflow run as failed

    return updated;
  }

  /**
   * Make a decision on a review task (approve/changes_requested/rejected)
   */
  async makeDecision(
    taskId: string,
    userId: string,
    decision: 'approved' | 'changes_requested' | 'rejected',
    comment?: string
  ): Promise<ReviewTask> {
    switch (decision) {
      case 'approved':
        return await this.approveTask(taskId, userId, comment);
      case 'changes_requested':
        if (!comment) {
          throw createError.validation("Comment is required when requesting changes");
        }
        return await this.requestChanges(taskId, userId, comment);
      case 'rejected':
        return await this.rejectTask(taskId, userId, comment);
      default:
        throw createError.validation("Invalid decision");
    }
  }
}

// Singleton instance
export const reviewTaskService = new ReviewTaskService();
