// The Midnight Vault — the hand-in program for make.fun.
//
// When the grader runs this file it copies the game and its screenshots
// into the output directory and writes dossier.json there, built from
// those exact files with the kit's vendored library. Outside the grader,
// MAKEFUN_OUTPUT_DIR stands in for /output, so the same command works
// locally: MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Standard library only, no build step, no network: the program only
// moves files around and writes one JSON file.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-game.ts";

// This file lives at the repository root, beside game/ and screenshots/.
const repoRoot = dirname(fileURLToPath(import.meta.url));

// The grader gives us /output; a local run names its own folder instead.
const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";

// Start clean so a stale file from an earlier run can never leak in.
// Never remove the output directory itself: in the grader /output is a
// mounted volume on a read-only root filesystem, so deleting it fails
// (EBUSY/EROFS) and the run exits 1. Clear only the known children we
// are about to overwrite instead.
mkdirSync(outDir, { recursive: true });
for (const child of ["game", "screenshots", "dossier.json"]) {
  const target = join(outDir, child);
  if (existsSync(target)) rmSync(target, { recursive: true, force: true });
}

// The game itself, then the screenshots the entry is judged on.
cpSync(join(repoRoot, "game"), join(outDir, "game"), { recursive: true });
cpSync(join(repoRoot, "screenshots"), join(outDir, "screenshots"), { recursive: true });

// The dossier: the library reads game/ and screenshots/ back out of the
// output directory and describes them, so what is handed in is exactly
// what was built. The caps are the bounty's own: 160 KiB of source text,
// at most 4 screenshots of at most 256 KiB each, at most 993 game entries.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(outDir, "dossier.json"), dossier);

console.log(`handed in The Midnight Vault to ${outDir}`);
