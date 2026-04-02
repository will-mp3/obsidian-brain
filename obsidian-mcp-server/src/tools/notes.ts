import fs from "fs";
import path from "path";
import { upsertFTS } from "../db/fts.js";
import { upsertVector } from "../db/vectors.js";
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

async function indexNote(
  vaultPath: string,
  notePath: string,
  content: string
): Promise<void> {
  const plain = stripFrontmatter(content);
  const title = extractTitle(notePath, plain);
  const mtime = Date.now();

  upsertFTS(vaultPath, notePath, title, plain, mtime);

  const embedding = await embed(plain);
  if (embedding) {
    upsertVector(vaultPath, notePath, embedding);
  }
}

export async function readNote(
  vaultPath: string,
  notePath: string
): Promise<string> {
  const fullPath = path.join(vaultPath, notePath);
  if (!fs.existsSync(fullPath)) {
    return `Error: Note not found at ${notePath}`;
  }
  return fs.readFileSync(fullPath, "utf-8");
}

export async function writeNote(
  vaultPath: string,
  notePath: string,
  content: string
): Promise<string> {
  const fullPath = path.join(vaultPath, notePath);
  const dir = path.dirname(fullPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(fullPath, content, "utf-8");
  await indexNote(vaultPath, notePath, content);

  return `Created note at ${notePath}`;
}

export async function updateNote(
  vaultPath: string,
  notePath: string,
  content: string,
  mode: "append" | "prepend" | "replace-section",
  section?: string
): Promise<string> {
  const fullPath = path.join(vaultPath, notePath);

  if (!fs.existsSync(fullPath)) {
    return `Error: Note not found at ${notePath}`;
  }

  let existing = fs.readFileSync(fullPath, "utf-8");

  switch (mode) {
    case "append":
      existing = existing.trimEnd() + "\n\n" + content;
      break;

    case "prepend":
      existing = content + "\n\n" + existing;
      break;

    case "replace-section": {
      if (!section) {
        return "Error: section name required for replace-section mode";
      }

      const sectionPattern = new RegExp(
        `(## ${section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n)([\\s\\S]*?)(?=\\n## |$)`
      );

      const match = existing.match(sectionPattern);
      if (!match) {
        return `Error: Section "## ${section}" not found in ${notePath}`;
      }

      existing = existing.replace(sectionPattern, `$1${content}\n`);
      break;
    }
  }

  fs.writeFileSync(fullPath, existing, "utf-8");
  await indexNote(vaultPath, notePath, existing);

  return `Updated note at ${notePath} (${mode})`;
}
