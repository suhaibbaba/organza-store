// Builds ../shared and makes it importable as @shared/* from this project.
//
// This used to be a package.json one-liner (`npm run build --prefix
// ../shared && mkdir -p node_modules && ln -sfn ../../shared/dist
// node_modules/@shared`), but that broke on Windows two ways: `mkdir -p`
// and `ln -sfn` aren't real commands there, and each extra `npm run` hop
// nests another cmd.exe /c layer, which can corrupt/truncate PATH deeply
// enough that the next `npm` call isn't found at all. Doing it in one
// plain Node script keeps this to a single hop and needs no shell built-ins.
//
// Copying (not symlinking) node_modules/@shared also sidesteps two more
// Windows issues: creating a symlink normally requires Developer Mode or an
// elevated shell, and Turbopack refuses to follow a symlink that resolves
// outside the project root anyway.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const sharedRoot = path.join(projectRoot, "..", "shared");

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit", shell: true });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!existsSync(path.join(sharedRoot, "node_modules"))) {
  run("npm", ["install"], sharedRoot);
}
run("npm", ["run", "build"], sharedRoot);

const dest = path.join(projectRoot, "node_modules", "@shared");
mkdirSync(path.join(projectRoot, "node_modules"), { recursive: true });
rmSync(dest, { recursive: true, force: true });
cpSync(path.join(sharedRoot, "dist"), dest, { recursive: true });

console.log(`[build-shared] @shared ready at ${dest}`);
