#!/usr/bin/env tsx
// ============================================================================
//  npm run email:preview — render every email, in every language, to disk.
//
//  Sends nothing, needs no API key, and touches no database. It writes one
//  .html and one .txt per template per language into tmp/email-preview/ (git
//  ignored) and prints the paths, so the Arabic layout can be opened in a
//  browser and CHECKED rather than assumed (CLAUDE.md: verify Arabic visually).
//
//  The plain-text half is written out too, because it is what a text-only
//  client and every spam filter actually read.
// ============================================================================
import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { SUPPORTED_LANGUAGES } from "@organza/shared/constants/languages";
import { PASSWORD_TOKEN_PURPOSES } from "@organza/shared/constants/passwordSetup";
import { renderPasswordSetupEmail } from "@/lib/email/templates/passwordSetup";
import { emailConfig } from "@/lib/email";
import { EMAIL_PREVIEW_DIR } from "@/constants";

// Obviously fake, and obviously long enough to show how a real one wraps in
// the fallback-link paragraph.
const SAMPLE_TOKEN = "PREVIEW-TOKEN-not-a-real-link-0000000000000000000000";
const SAMPLE_NAMES: Record<string, string> = {
  ar: "روان",
  en: "Rawand",
  he: "רואנד",
};

async function main(): Promise<void> {
  const outDir = path.resolve(__dirname, "..", EMAIL_PREVIEW_DIR);
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });

  const { adminUrl } = emailConfig();
  const written: string[] = [];

  for (const purpose of PASSWORD_TOKEN_PURPOSES) {
    for (const language of SUPPORTED_LANGUAGES) {
      const rendered = renderPasswordSetupEmail({
        language,
        name: SAMPLE_NAMES[language] ?? "Organza",
        token: SAMPLE_TOKEN,
        purpose,
        adminUrl,
      });

      const base = `password-${purpose.toLowerCase()}.${language}`;
      const htmlPath = path.join(outDir, `${base}.html`);
      const textPath = path.join(outDir, `${base}.txt`);
      await fs.writeFile(htmlPath, rendered.html, "utf8");
      await fs.writeFile(textPath, `Subject: ${rendered.subject}\n\n${rendered.text}\n`, "utf8");
      written.push(htmlPath, textPath);
    }
  }

  console.log(`Rendered ${written.length} file(s) into ${outDir}\n`);
  for (const file of written) console.log(`  ${file}`);
  console.log("\nOpen the .html files in a browser — the ar/he ones should read right-to-left.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
