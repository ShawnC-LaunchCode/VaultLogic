import { db, initializeDatabase } from "./server/db";
import { users } from "./shared/schema";
import { eq } from "drizzle-orm";

async function main() {
    await initializeDatabase();
    console.log("Checking for users...");
    const allUsers = await db.select().from(users);
    console.log(`Found ${allUsers.length} users.`);
    allUsers.forEach(u => console.log(`- ${u.email} (Provider: ${u.authProvider}) Verified: ${u.emailVerified}`));
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
