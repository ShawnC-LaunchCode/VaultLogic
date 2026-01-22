import templatesRouter from "./templates.routes";

import type { Express } from "express";

/**
 * Register Stage 4 Templates API routes
 */
export function registerApiTemplateRoutes(app: Express): void {
  app.use('/api', templatesRouter);
}
