// Essential data for a real shop; run on every deploy, safe to repeat, never touches what the shop changed.
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { runBootstrap } from "@/lib/bootstrap";

async function main(): Promise<void> {
  const summary = await runBootstrap();
  console.log(`created: ${summary.created.length}`);
  for (const key of summary.created) {
    console.log(`  + ${key}`);
  }
  console.log(`adopted (already present): ${summary.adopted.length}`);
  console.log(`skipped (bootstrapped earlier): ${summary.skipped.length}`);
  console.log("Essential data is in place.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
