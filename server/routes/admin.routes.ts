import type { Express, Request, Response } from "express";
import { isAdmin } from "../middleware/adminAuth";
import { userRepository } from "../repositories/UserRepository";
import { WorkflowRepository } from "../repositories/WorkflowRepository";
import { WorkflowRunRepository } from "../repositories/WorkflowRunRepository";
import { ActivityLogService } from "../services/ActivityLogService";
import { createLogger } from "../logger";

const logger = createLogger({ module: 'admin-routes' });
const activityLogService = new ActivityLogService();

/**
 * Register admin-only routes
 * These routes require admin role for access
 *
 * NOTE: Refactored from survey-based to workflow-based (Nov 2025)
 */
export function registerAdminRoutes(app: Express): void {
  const workflowRepository = new WorkflowRepository();
  const workflowRunRepository = new WorkflowRunRepository();

  // ============================================================================
  // User Management
  // ============================================================================

  /**
   * GET /api/admin/users
   * Get all users in the system
   */
  app.get('/api/admin/users', isAdmin, async (req: Request, res: Response) => {
    try {
      if (!req.adminUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const users = await userRepository.findAllUsers();

      // Return users with workflow count
      const usersWithStats = await Promise.all(
        users.map(async (user) => {
          const workflows = await workflowRepository.findByCreatorId(user.id);
          return {
            ...user,
            workflowCount: workflows.length,
          };
        })
      );

      logger.info(
        { adminId: req.adminUser!.id, userCount: users.length },
        'Admin fetched all users'
      );

      res.json(usersWithStats);
    } catch (error) {
      logger.error({ err: error, adminId: req.adminUser!.id }, 'Error fetching all users');
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  /**
   * PUT /api/admin/users/:userId/role
   * Update user role (promote/demote admin)
   */
  app.put('/api/admin/users/:userId/role', isAdmin, async (req: Request, res: Response) => {
    try {
      if (!req.adminUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { userId } = req.params;
      const { role } = req.body;

      if (!role || (role !== 'admin' && role !== 'creator')) {
        return res.status(400).json({
          message: "Invalid role. Must be 'admin' or 'creator'"
        });
      }

      // Prevent self-demotion
      if (userId === req.adminUser!.id && role === 'creator') {
        return res.status(400).json({
          message: "You cannot demote yourself from admin"
        });
      }

      // Critical: Prevent demoting the last admin
      if (role === 'creator') {
        const allUsers = await userRepository.findAllUsers();
        const adminCount = allUsers.filter(u => u.role === 'admin').length;

        // Check if the user being demoted is currently an admin
        const targetUser = allUsers.find(u => u.id === userId);
        if (targetUser?.role === 'admin' && adminCount <= 1) {
          return res.status(400).json({
            message: "Cannot demote the last admin. Promote another user to admin first."
          });
        }
      }

      const updatedUser = await userRepository.updateRole(userId, role);

      logger.info(
        {
          adminId: req.adminUser!.id,
          targetUserId: userId,
          newRole: role,
          oldRole: role === 'admin' ? 'creator' : 'admin'
        },
        `Admin ${role === 'admin' ? 'promoted' : 'demoted'} user`
      );

      res.json({
        message: `User ${role === 'admin' ? 'promoted to admin' : 'demoted to creator'}`,
        user: updatedUser
      });
    } catch (error) {
      logger.error(
        { err: error, adminId: req.adminUser!.id, userId: req.params.userId },
        'Error updating user role'
      );

      if (error instanceof Error && error.message === 'User not found') {
        return res.status(404).json({ message: "User not found" });
      }

      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  /**
   * GET /api/admin/users/:userId/workflows
   * Get all workflows for a specific user
   */
  app.get('/api/admin/users/:userId/workflows', isAdmin, async (req: Request, res: Response) => {
    try {
      if (!req.adminUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { userId } = req.params;

      // Verify user exists
      const user = await userRepository.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const workflows = await workflowRepository.findByCreatorId(userId);

      logger.info(
        { adminId: req.adminUser!.id, targetUserId: userId, workflowCount: workflows.length },
        'Admin fetched user workflows'
      );

      res.json({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        workflows
      });
    } catch (error) {
      logger.error(
        { err: error, adminId: req.adminUser!.id, userId: req.params.userId },
        'Error fetching user workflows'
      );
      res.status(500).json({ message: "Failed to fetch user workflows" });
    }
  });

  // ============================================================================
  // Workflow Management (Admin can view/edit any workflow)
  // ============================================================================

  /**
   * GET /api/admin/workflows
   * Get all workflows in the system
   */
  app.get('/api/admin/workflows', isAdmin, async (req: Request, res: Response) => {
    try {
      if (!req.adminUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Get all users first
      const users = await userRepository.findAllUsers();

      // Get workflows for each user
      const allWorkflows = await Promise.all(
        users.map(async (user) => {
          const workflows = await workflowRepository.findByCreatorId(user.id);
          return workflows.map((workflow: any) => ({
            ...workflow,
            creator: {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
            }
          }));
        })
      );

      const flattenedWorkflows = allWorkflows.flat();

      logger.info(
        { adminId: req.adminUser!.id, workflowCount: flattenedWorkflows.length },
        'Admin fetched all workflows'
      );

      res.json(flattenedWorkflows);
    } catch (error) {
      logger.error({ err: error, adminId: req.adminUser!.id }, 'Error fetching all workflows');
      res.status(500).json({ message: "Failed to fetch workflows" });
    }
  });

  /**
   * GET /api/admin/workflows/:workflowId
   * Get any workflow (including full details)
   */
  app.get('/api/admin/workflows/:workflowId', isAdmin, async (req: Request, res: Response) => {
    try {
      if (!req.adminUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const workflow = await workflowRepository.findById(req.params.workflowId);

      if (!workflow) {
        return res.status(404).json({ message: "Workflow not found" });
      }

      logger.info(
        { adminId: req.adminUser!.id, workflowId: req.params.workflowId },
        'Admin fetched workflow details'
      );

      res.json(workflow);
    } catch (error) {
      logger.error(
        { err: error, adminId: req.adminUser!.id, workflowId: req.params.workflowId },
        'Error fetching workflow'
      );
      res.status(500).json({ message: "Failed to fetch workflow" });
    }
  });

  /**
   * GET /api/admin/workflows/:workflowId/runs
   * Get all runs for any workflow
   */
  app.get('/api/admin/workflows/:workflowId/runs', isAdmin, async (req: Request, res: Response) => {
    try {
      if (!req.adminUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const workflow = await workflowRepository.findById(req.params.workflowId);

      if (!workflow) {
        return res.status(404).json({ message: "Workflow not found" });
      }

      const runs = await workflowRunRepository.findByWorkflowId(req.params.workflowId);

      logger.info(
        { adminId: req.adminUser!.id, workflowId: req.params.workflowId, runCount: runs.length },
        'Admin fetched workflow runs'
      );

      res.json(runs);
    } catch (error) {
      logger.error(
        { err: error, adminId: req.adminUser!.id, workflowId: req.params.workflowId },
        'Error fetching workflow runs'
      );
      res.status(500).json({ message: "Failed to fetch runs" });
    }
  });

  /**
   * DELETE /api/admin/workflows/:workflowId
   * Delete any workflow
   */
  app.delete('/api/admin/workflows/:workflowId', isAdmin, async (req: Request, res: Response) => {
    try {
      if (!req.adminUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const workflow = await workflowRepository.findById(req.params.workflowId);

      if (!workflow) {
        return res.status(404).json({ message: "Workflow not found" });
      }

      // Count runs before deletion (they'll be cascade deleted)
      const runs = await workflowRunRepository.findByWorkflowId(req.params.workflowId);
      const runCount = runs.length;

      // Delete the workflow (cascade deletes sections, steps, runs, etc.)
      await workflowRepository.delete(req.params.workflowId);

      logger.warn(
        {
          adminId: req.adminUser!.id,
          workflowId: req.params.workflowId,
          workflowTitle: workflow.title,
          deletedRuns: runCount
        },
        'Admin deleted workflow'
      );

      res.json({ message: "Workflow deleted successfully" });
    } catch (error) {
      logger.error(
        { err: error, adminId: req.adminUser!.id, workflowId: req.params.workflowId },
        'Error deleting workflow'
      );
      res.status(500).json({ message: "Failed to delete workflow" });
    }
  });

  // ============================================================================
  // Admin Dashboard Stats
  // ============================================================================

  /**
   * GET /api/admin/stats
   * Get system-wide statistics
   */
  app.get('/api/admin/stats', isAdmin, async (req: Request, res: Response) => {
    try {
      if (!req.adminUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const users = await userRepository.findAllUsers();
      const adminCount = users.filter(u => u.role === 'admin').length;

      // Get all workflows across all users
      const allWorkflows = await Promise.all(
        users.map(user => workflowRepository.findByCreatorId(user.id))
      );
      const flattenedWorkflows = allWorkflows.flat();

      // Get all runs across all workflows
      const workflowIds = flattenedWorkflows.map((w: any) => w.id);
      let allRuns: any[] = [];
      if (workflowIds.length > 0) {
        allRuns = await workflowRunRepository.findByWorkflowIds(workflowIds);
      }

      const stats = {
        totalUsers: users.length,
        adminUsers: adminCount,
        creatorUsers: users.length - adminCount,
        totalWorkflows: flattenedWorkflows.length,
        activeWorkflows: flattenedWorkflows.filter((w: any) => w.status === 'active').length,
        draftWorkflows: flattenedWorkflows.filter((w: any) => w.status === 'draft').length,
        archivedWorkflows: flattenedWorkflows.filter((w: any) => w.status === 'archived').length,
        totalRuns: allRuns.length,
        completedRuns: allRuns.filter((r: any) => r.completed).length,
        inProgressRuns: allRuns.filter((r: any) => !r.completed).length,
      };

      logger.info({ adminId: req.adminUser!.id }, 'Admin fetched system stats');

      res.json(stats);
    } catch (error) {
      logger.error({ err: error, adminId: req.adminUser!.id }, 'Error fetching admin stats');
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  // ============================================================================
  // Activity Logs
  // ============================================================================

  /**
   * GET /api/admin/logs
   * Get activity logs with filtering and pagination
   */
  app.get('/api/admin/logs', isAdmin, async (req: Request, res: Response) => {
    try {
      if (!req.adminUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const query = {
        q: req.query.q as string | undefined,
        event: req.query.event as string | undefined,
        actor: req.query.actor as string | undefined,
        entityType: req.query.entityType as string | undefined,
        entityId: req.query.entityId as string | undefined,
        status: req.query.status as string | undefined,
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
        limit: req.query.limit ? Number(req.query.limit) : 50,
        offset: req.query.offset ? Number(req.query.offset) : 0,
        sort: (req.query.sort as "timestamp_desc" | "timestamp_asc") || "timestamp_desc",
      };

      const result = await activityLogService.list(query);

      logger.info(
        {
          adminId: req.adminUser!.id,
          query,
          resultCount: result.rows.length,
          total: result.total
        },
        'Admin fetched activity logs'
      );

      res.json(result);
    } catch (error) {
      logger.error({ err: error, adminId: req.adminUser!.id }, 'Error fetching activity logs');
      res.status(500).json({ message: "Failed to fetch activity logs" });
    }
  });

  /**
   * GET /api/admin/logs/export
   * Export activity logs to CSV
   */
  app.get('/api/admin/logs/export', isAdmin, async (req: Request, res: Response) => {
    try {
      if (!req.adminUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const query = {
        q: req.query.q as string | undefined,
        event: req.query.event as string | undefined,
        actor: req.query.actor as string | undefined,
        entityType: req.query.entityType as string | undefined,
        entityId: req.query.entityId as string | undefined,
        status: req.query.status as string | undefined,
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
        sort: (req.query.sort as "timestamp_desc" | "timestamp_asc") || "timestamp_desc",
        limit: 5000, // Export limit
        offset: 0,
      };

      const { filename, csv } = await activityLogService.exportCsv(query);

      logger.info(
        { adminId: req.adminUser!.id, query, filename },
        'Admin exported activity logs to CSV'
      );

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (error) {
      logger.error({ err: error, adminId: req.adminUser!.id }, 'Error exporting activity logs');
      res.status(500).json({ message: "Failed to export activity logs" });
    }
  });

  /**
   * GET /api/admin/logs/events
   * Get unique event types for filter dropdowns
   */
  app.get('/api/admin/logs/events', isAdmin, async (req: Request, res: Response) => {
    try {
      if (!req.adminUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const events = await activityLogService.getUniqueEvents();

      logger.info(
        { adminId: req.adminUser!.id, eventCount: events.length },
        'Admin fetched unique event types'
      );

      res.json(events);
    } catch (error) {
      logger.error({ err: error, adminId: req.adminUser!.id }, 'Error fetching event types');
      res.status(500).json({ message: "Failed to fetch event types" });
    }
  });

  /**
   * GET /api/admin/logs/actors
   * Get unique actors for filter dropdowns
   */
  app.get('/api/admin/logs/actors', isAdmin, async (req: Request, res: Response) => {
    try {
      if (!req.adminUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const actors = await activityLogService.getUniqueActors();

      logger.info(
        { adminId: req.adminUser!.id, actorCount: actors.length },
        'Admin fetched unique actors'
      );

      res.json(actors);
    } catch (error) {
      logger.error({ err: error, adminId: req.adminUser!.id }, 'Error fetching actors');
      res.status(500).json({ message: "Failed to fetch actors" });
    }
  });
}
