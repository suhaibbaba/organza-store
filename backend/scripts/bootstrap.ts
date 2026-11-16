// Essential data for a real shop. Run on every deploy — it is safe to run
// repeatedly and never touches anything the shop has since changed.
//
//   npm run bootstrap
//
// This is what REPLACED `npm run seed` in the deploy pipeline. The demo seed
// (products, orders, test accounts) is quarantined under prisma/dev/ and can
// only be run by hand against a disposable database.
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { runBootstrap } from "@/lib/bootstrap";

async function main(): Promise<void> {
  const summary = await runBootstrap();
  console.log(`created: ${summary.created.length}`);
  for (const key of summary.created) console.log(`  + ${key}`);
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
