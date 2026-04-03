import fs from "fs";
import path from "path";
import { getMtime, upsertFTS, deleteFTS, allIndexedPaths } from "../db/fts.js";
import { upsertVector, deleteVector, allVectorPaths } from "../db/vectors.js";
import { embed } from "../embeddings/ollama.js";

function stripFrontmatter(content: string): string {
  if (content.startsWith("---")) {
    const end = content.indexOf("---", 3);
    if (end !== -1) return content.slice(end + 3).trim();
  }
  return content;
}

function extractTitle(notePath: string, content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  if (match) return match[1];
  return path.basename(notePath, ".md");
}

function walkAllMd(dir: string, base: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;

    const fullPath = path.join(dir, entry.name);

    if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push(path.relative(base, fullPath));
    } else if (entry.isDirectory()) {
      results.push(...walkAllMd(fullPath, base));
    }
  }

  return results;
}

export async function reindexVault(
  vaultPath: string
): Promise<{ indexed: number; skipped: number; removed: number }> {
  const allFiles = walkAllMd(vaultPath, vaultPath);
  const fileSet = new Set(allFiles);

  let indexed = 0;
  let skipped = 0;
  let removed = 0;

  // Remove stale entries for files that no longer exist on disk
  const indexedPaths = allIndexedPaths(vaultPath);
  for (const p of indexedPaths) {
    if (!fileSet.has(p)) {
      deleteFTS(vaultPath, p);
      deleteVector(vaultPath, p);
      removed++;
    }
  }

  // Also clean up any vector-only orphans
  const vectorPaths = allVectorPaths(vaultPath);
  for (const p of vectorPaths) {
    if (!fileSet.has(p)) {
      deleteVector(vaultPath, p);
    }
  }

  // Index new and changed files
  for (const relPath of allFiles) {
    const fullPath = path.join(vaultPath, relPath);
    const stat = fs.statSync(fullPath);
    const fileMtime = stat.mtimeMs;

    const storedMtime = getMtime(vaultPath, relPath);

    if (storedMtime !== null && fileMtime <= storedMtime) {
      skipped++;
      continue;
    }

    const content = fs.readFileSync(fullPath, "utf-8");
    const plain = stripFrontmatter(content);
    const title = extractTitle(relPath, plain);

    upsertFTS(vaultPath, relPath, title, plain, fileMtime);

    const embedding = await embed(plain);
    if (embedding) {
      upsertVector(vaultPath, relPath, embedding);
    }

    indexed++;
  }

  return { indexed, skipped, removed };
}
