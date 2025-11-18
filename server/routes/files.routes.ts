/**
 * DEPRECATED: Legacy Survey File Upload Routes
 *
 * This file contained file upload routes tied to the legacy survey system,
 * which was removed in November 2025. File uploads are now handled through
 * the workflow system via workflow step values.
 *
 * Status: Disabled (not registered in routes/index.ts)
 *
 * For workflow file uploads, see:
 * - Step type: 'file_upload' in workflow steps
 * - Storage in stepValues table
 * - Authorization through workflow runs
 */

import type { Express } from "express";

/**
 * Stub function to maintain compatibility with route registration
 * This function does nothing - the routes are disabled
 */
export function registerFileRoutes(app: Express): void {
  // Legacy file routes disabled - survey system removed Nov 2025
  // File uploads now handled through workflow system
}
