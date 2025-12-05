import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";
import { log } from "./utils";

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const viteLogger = createLogger();

export async function setupVite(app: Express, server: Server) {
  // Resolve vite config (it's a function that needs to be called)
  const resolvedConfig = typeof viteConfig === 'function'
    ? viteConfig({ mode: process.env.NODE_ENV || 'development', command: 'serve', isSsrBuild: false, isPreview: false })
    : viteConfig;

  const serverOptions = {
    ...resolvedConfig.server,
    middlewareMode: true,
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...resolvedConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        // Log the error but don't kill the server process
        // Vite will recover from most errors automatically
        viteLogger.error(msg, options);
      },
    },
    server: {
      ...serverOptions,
      hmr: {
        ...(typeof resolvedConfig.server?.hmr === 'object' ? resolvedConfig.server.hmr : {}),
        server,
      },
    },
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    // Skip API routes - let them be handled by Express routes
    if (url.startsWith("/api")) {
      return next();
    }

    try {
      const clientTemplate = path.resolve(
        __dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

