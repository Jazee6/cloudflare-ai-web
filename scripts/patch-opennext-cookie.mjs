import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TARGET_FILES = [
  ".open-next/middleware/handler.mjs",
  ".open-next/server-functions/default/handler.mjs",
];

/**
 * Normalizes esbuild's CJS/ESM interop for `cookie@1.1.1`, where `exports.__esModule`
 * is `true` without a `default` export so `(import_cookie.default)` evaluates to `undefined`.
 */
export function patchCookieImport(source) {
  return source.replace(/\b(import_cookie\d*)\.default\.parse\(/g, "($1.default??$1).parse(");
}

function main() {
  for (const relativePath of TARGET_FILES) {
    const filePath = path.resolve(process.cwd(), relativePath);
    if (!existsSync(filePath)) {
      continue;
    }

    const original = readFileSync(filePath, "utf8");
    const patched = patchCookieImport(original);
    if (patched !== original) {
      writeFileSync(filePath, patched, "utf8");
      console.log(`Patched OpenNext cookie interop in ${relativePath}`);
    }
  }
}

if (
  typeof process.argv[1] === "string" &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  main();
}
