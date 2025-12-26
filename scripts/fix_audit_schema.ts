
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
    console.log("Altering audit_logs table...");
    try {
        await db.execute(sql`ALTER TABLE audit_logs ALTER COLUMN workspace_id DROP NOT NULL;`);
        console.log("Successfully altered audit_logs table.");
    } catch (error) {
        console.error("Failed to alter table:", error);
    }
    process.exit(0);
}

main();
