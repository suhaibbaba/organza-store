// Rebuilds every numbered shawl's burned-in photo: npm run images:mark (run on every deploy).
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { rebuildAllMarkedImages } from "@/lib/markedImage";

async function main(): Promise<void> {
  const checked = await rebuildAllMarkedImages();
  console.log(`Numbered photos checked: ${checked}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
