// Rebuilds the search index from the database: npm run search:reindex (run on every deploy).
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { reindexAllProducts } from "@/lib/search";

async function main(): Promise<void> {
  const summary = await reindexAllProducts();
  console.log(`Search engine: ${summary.engine}`);
  console.log(`Indexed products: ${summary.indexed}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
