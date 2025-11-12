/**
 * External Connections API Routes
 * Manages reusable API connection configurations for HTTP nodes
 * RBAC: Owner/Builder can manage connections; Runner/Viewer have read-only access
 */

import type { Express, Request, Response } from 'express';
import { isAuthenticated } from '../googleAuth';
import { z } from 'zod';
import { logger } from '../logger';
import {
  listConnections,
  getConnection,
  createConnection,
  updateConnection,
  deleteConnection,
  type CreateConnectionInput,
  type UpdateConnectionInput,
} from '../services/externalConnections';

/**
 * Validation schemas
 */
const createConnectionSchema = z.object({
  name: z.string().min(1).max(255),
  baseUrl: z.string().url('baseUrl must be a valid URL'),
  authType: z.enum(['api_key', 'bearer', 'oauth2', 'basic_auth', 'none']),
  secretId: z.string().uuid().optional().nullable(),
  defaultHeaders: z.record(z.string()).optional(),
  timeoutMs: z.number().int().min(100).max(60000).optional(),
  retries: z.number().int().min(0).max(10).optional(),
  backoffMs: z.number().int().min(0).max(5000).optional(),
});

const updateConnectionSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  baseUrl: z.string().url().optional(),
  authType: z.enum(['api_key', 'bearer', 'oauth2', 'basic_auth', 'none']).optional(),
  secretId: z.string().uuid().optional().nullable(),
  defaultHeaders: z.record(z.string()).optional(),
  timeoutMs: z.number().int().min(100).max(60000).optional(),
  retries: z.number().int().min(0).max(10).optional(),
  backoffMs: z.number().int().min(0).max(5000).optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

/**
 * Register external connections routes
 */
export function registerConnectionsRoutes(app: Express): void {
  /**
   * GET /api/projects/:projectId/connections
   * List all external connections for a project
   * Required role: Any authenticated user with project access
   */
  app.get('/api/projects/:projectId/connections', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized - no user ID' });
      }

      const { projectId } = req.params;

      // TODO: Add ACL check for project access

      const connections = await listConnections(projectId);
      res.json(connections);
    } catch (error) {
      logger.error({ error, projectId: req.params.projectId }, 'Error listing connections');
      res.status(500).json({
        message: 'Failed to list connections',
        error: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined,
      });
    }
  });

  /**
   * GET /api/projects/:projectId/connections/:connectionId
   * Get a single external connection
   * Required role: Any authenticated user with project access
   */
  app.get('/api/projects/:projectId/connections/:connectionId', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized - no user ID' });
      }

      const { projectId, connectionId } = req.params;

      const connection = await getConnection(projectId, connectionId);
      if (!connection) {
        return res.status(404).json({ message: 'Connection not found' });
      }

      res.json(connection);
    } catch (error) {
      logger.error({ error, connectionId: req.params.connectionId }, 'Error fetching connection');
      res.status(500).json({ message: 'Failed to fetch connection' });
    }
  });

  /**
   * POST /api/projects/:projectId/connections
   * Create a new external connection
   * Required role: Owner or Builder
   */
  app.post('/api/projects/:projectId/connections', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized - no user ID' });
      }

      const { projectId } = req.params;

      // Validate input
      const validatedData = createConnectionSchema.parse(req.body);

      // Create connection
      const input: CreateConnectionInput = {
        projectId,
        ...validatedData,
      };

      const connection = await createConnection(input);

      logger.info({ connectionId: connection.id, projectId, name: connection.name }, 'Connection created');

      res.status(201).json(connection);
    } catch (error) {
      logger.error({ error, projectId: req.params.projectId }, 'Error creating connection');

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: 'Validation error',
          errors: error.errors,
        });
      }

      if (error instanceof Error && error.message.includes('already exists')) {
        return res.status(409).json({ message: error.message });
      }

      if (error instanceof Error && error.message.includes('Secret not found')) {
        return res.status(400).json({ message: error.message });
      }

      res.status(500).json({
        message: 'Failed to create connection',
        error: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined,
      });
    }
  });

  /**
   * PATCH /api/projects/:projectId/connections/:connectionId
   * Update an external connection
   * Required role: Owner or Builder
   */
  app.patch('/api/projects/:projectId/connections/:connectionId', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized - no user ID' });
      }

      const { projectId, connectionId } = req.params;

      // Validate input
      const validatedData = updateConnectionSchema.parse(req.body);

      // Update connection
      const input: UpdateConnectionInput = validatedData;
      const connection = await updateConnection(projectId, connectionId, input);

      logger.info({ connectionId, projectId }, 'Connection updated');

      res.json(connection);
    } catch (error) {
      logger.error({ error, connectionId: req.params.connectionId }, 'Error updating connection');

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: 'Validation error',
          errors: error.errors,
        });
      }

      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return res.status(404).json({ message: error.message });
        }
        if (error.message.includes('already exists')) {
          return res.status(409).json({ message: error.message });
        }
        if (error.message.includes('Secret not found')) {
          return res.status(400).json({ message: error.message });
        }
      }

      res.status(500).json({
        message: 'Failed to update connection',
        error: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined,
      });
    }
  });

  /**
   * DELETE /api/projects/:projectId/connections/:connectionId
   * Delete an external connection
   * Required role: Owner or Builder
   */
  app.delete('/api/projects/:projectId/connections/:connectionId', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized - no user ID' });
      }

      const { projectId, connectionId } = req.params;

      const deleted = await deleteConnection(projectId, connectionId);
      if (!deleted) {
        return res.status(404).json({ message: 'Connection not found' });
      }

      logger.info({ connectionId, projectId }, 'Connection deleted');

      res.status(204).send();
    } catch (error) {
      logger.error({ error, connectionId: req.params.connectionId }, 'Error deleting connection');
      res.status(500).json({ message: 'Failed to delete connection' });
    }
  });
}
