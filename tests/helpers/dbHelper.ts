import { getDb, initializeDatabase, dbInitPromise } from "../../server/db";

/**
 * Get the database instance for tests
 * Ensures database is initialized before returning
 *
 * Usage in tests:
 * ```typescript
 * import { getTestDb } from '../helpers/dbHelper';
 *
 * const db = await getTestDb();
 * await db.insert(schema.tenants).values({...});
 * ```
 */
export async function getTestDb() {
  // Wait for database initialization
  await dbInitPromise;

  // Get the initialized database
  return getDb();
}

/**
 * Ensure database is initialized
 * Call this in beforeAll hooks
 */
export async function ensureTestDbInitialized() {
  await initializeDatabase();
  await dbInitPromise;
}
