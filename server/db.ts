import dotenv from "dotenv";
dotenv.config();

import * as schema from "@shared/schema";
import type { Pool } from 'pg';
import type { Pool as NeonPool } from '@neondatabase/serverless';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { NeonDatabase } from 'drizzle-orm/neon-serverless';

type DrizzleDB = NodePgDatabase<typeof schema> | NeonDatabase<typeof schema>;

let pool: Pool | NeonPool;
let _db: DrizzleDB | null = null;  // Internal db reference
let dbInitialized = false;
let dbInitPromise: Promise<void>;

// Initialize database connection
async function initializeDatabase() {
  if (dbInitialized) return;

  const databaseUrl = process.env.DATABASE_URL;
  const isDatabaseConfigured = !!databaseUrl && databaseUrl !== 'undefined' && databaseUrl !== '';

  if (!isDatabaseConfigured) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?"
    );
  }

  // Detect if we're using Neon serverless or local PostgreSQL
  const isNeonDatabase = isDatabaseConfigured && (
    databaseUrl!.includes('neon.tech') || databaseUrl!.includes('neon.co')
  );

  if (isNeonDatabase) {
    // Use Neon serverless driver for cloud databases
    const { Pool: NeonPoolClass, neonConfig } = await import('@neondatabase/serverless');
    const ws = await import('ws');

    neonConfig.webSocketConstructor = ws.default;
    pool = new NeonPoolClass({ connectionString: databaseUrl });

    const { drizzle: drizzleNeon } = await import('drizzle-orm/neon-serverless');
    _db = drizzleNeon(pool as any, { schema });
  } else {
    // Use standard PostgreSQL driver for local databases
    const pg = await import('pg');
    pool = new pg.default.Pool({ connectionString: databaseUrl });

    const { drizzle: drizzlePg } = await import('drizzle-orm/node-postgres');
    _db = drizzlePg(pool as any, { schema });
  }

  dbInitialized = true;
}

// Start initialization immediately only if database is configured
// If not configured, create a lazy promise that will reject when awaited
// For tests, we might initialize later manually
const initialDatabaseUrl = process.env.DATABASE_URL;
const isInitialConfigured = !!initialDatabaseUrl && initialDatabaseUrl !== 'undefined' && initialDatabaseUrl !== '';

dbInitPromise = isInitialConfigured
  ? initializeDatabase()
  : Promise.resolve(); // Don't reject immediately to avoid unhandled rejection errors in tests

// Getter to ensure db is initialized before use
function getDb() {
  if (!dbInitialized) {
    throw new Error("Database not initialized. Call await initializeDatabase() first.");
  }
  return _db;
}

// Create a getter for db that returns the initialized database
// This ensures that code importing { db } will get the properly initialized instance
const db = new Proxy({} as DrizzleDB, {
  get(target, prop) {
    if (!_db) {
      throw new Error("Database not initialized. Call await initializeDatabase() first.");
    }
    return _db[prop as keyof DrizzleDB];
  },
  set(target, prop, value) {
    if (!_db) {
      throw new Error("Database not initialized. Call await initializeDatabase() first.");
    }
    _db[prop] = value;
    return true;
  }
});

export { pool, db, getDb, initializeDatabase, dbInitPromise };
