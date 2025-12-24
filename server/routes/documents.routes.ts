/**
 * Documents API Routes
 * Handles document template listing for Final Block configuration
 *
 * This is a simplified endpoint for Prompt 9.
 * Full document management will be implemented in Prompt 10.
 *
 * @version 1.0.0 - Prompt 9 (Final Block)
 * @date December 2025
 */

import type { Express, Request, Response } from 'express';
import { hybridAuth, type AuthRequest } from '../middleware/auth';
import { requireProjectRole } from '../middleware/aclAuth';
import { db } from '../db';
import { templates } from '@/../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { createLogger } from '../logger';
import { aclService } from '../services/AclService';

const logger = createLogger({ module: 'documents-routes' });

/**
 * Register document-related routes
 */
export function registerDocumentRoutes(app: Express): void {
  /**
   * GET /api/documents
   * List all document templates available to the user
   *
   * Query params:
   * - projectId (optional): Filter by project
   *
   * Returns:
   * [
   *   { id: string, name: string, type: string, uploadedAt: Date },
   *   ...
   * ]
   */
  app.get('/api/documents', hybridAuth, async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.userId;

      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized - no user ID' });
      }

      const { projectId } = req.query;

      // If projectId is specified, verify user has access to that project
      if (projectId && typeof projectId === 'string') {
        const hasAccess = await aclService.hasProjectRole(userId, projectId, 'view');
        if (!hasAccess) {
          logger.warn({ userId, projectId }, 'User denied access to project documents');
          return res.status(403).json({ message: 'Forbidden - insufficient permissions for this project' });
        }
      }

      // Build query
      let query = db.select({
        id: templates.id,
        name: templates.name,
        type: templates.type,
        uploadedAt: templates.createdAt,
        fileRef: templates.fileRef,
        projectId: templates.projectId,
      }).from(templates);

      // Filter by project if specified
      if (projectId && typeof projectId === 'string') {
        query = query.where(eq(templates.projectId, projectId)) as any;
      }

      const documents = await query;

      // Filter documents to only include those from projects user has access to
      const accessibleDocs = await Promise.all(
        documents.map(async (doc) => {
          if (!doc.projectId) return doc;
          const hasAccess = await aclService.hasProjectRole(userId, doc.projectId, 'view');
          return hasAccess ? doc : null;
        })
      );

      const filteredDocs = accessibleDocs.filter((doc): doc is NonNullable<typeof doc> => doc !== null);

      // Format response
      const formattedDocs = filteredDocs.map((doc) => ({
        id: doc.id,
        name: doc.name,
        type: doc.type || 'docx',
        uploadedAt: doc.uploadedAt,
        fileRef: doc.fileRef,
      }));

      logger.info({ count: formattedDocs.length, userId, projectId }, 'Fetched documents');

      res.json(formattedDocs);
    } catch (error) {
      logger.error({ error }, 'Error fetching documents');
      res.status(500).json({ message: 'Failed to fetch documents' });
    }
  });

  /**
   * GET /api/documents/:id
   * Get a single document template by ID
   *
   * Returns:
   * { id: string, name: string, type: string, uploadedAt: Date, ... }
   */
  app.get('/api/documents/:id', hybridAuth, async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.userId;

      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized - no user ID' });
      }

      const { id } = req.params;

      const [document] = await db
        .select()
        .from(templates)
        .where(
          and(
            eq(templates.id, id)
          )
        )
        .limit(1);

      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }

      // Check ACL based on document's project
      if (document.projectId) {
        const hasAccess = await aclService.hasProjectRole(userId, document.projectId, 'view');
        if (!hasAccess) {
          logger.warn({ userId, projectId: document.projectId, documentId: id }, 'User denied access to document');
          return res.status(403).json({ message: 'Forbidden - insufficient permissions for this document' });
        }
      }

      logger.info({ documentId: id, userId }, 'Fetched document');

      res.json({
        id: document.id,
        name: document.name,
        type: document.type || 'docx',
        uploadedAt: document.createdAt,
        fileRef: document.fileRef,
        projectId: document.projectId,
      });
    } catch (error) {
      logger.error({ error }, 'Error fetching document');
      res.status(500).json({ message: 'Failed to fetch document' });
    }
  });

  logger.info('Document routes registered');
}
