// Applies the versioned index settings in src/constants/searchIndex.ts: npm run search:setup.
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { applySearchSettings } from "@/lib/search";

async function main(): Promise<void> {
  const summary = await applySearchSettings();
  console.log(`Search engine: ${summary.engine}`);
  console.log(`Index settings version ${summary.version} applied.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
