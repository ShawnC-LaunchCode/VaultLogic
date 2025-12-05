import dotenv from "dotenv";
dotenv.config();

import { userRepository } from '../server/repositories';
import { initializeDatabase } from '../server/db';

async function testFindById() {
  console.log("🔍 Testing userRepository.findById...\n");

  // Initialize database first
  await initializeDatabase();

  const userId = '116568744155653496130';

  try {
    const user = await userRepository.findById(userId);

    console.log("Result from userRepository.findById:");
    console.log(JSON.stringify(user, null, 2));

    if (user) {
      console.log("\n📊 Key fields:");
      console.log(`  id: ${user.id}`);
      console.log(`  email: ${user.email}`);
      console.log(`  role: ${user.role}`);
      console.log(`  tenantRole: ${user.tenantRole}`);
      console.log(`  tenantId: ${user.tenantId}`);
    } else {
      console.log("❌ User not found!");
    }
  } catch (error) {
    console.error("❌ Error:", error);
  }

  process.exit(0);
}

testFindById();
