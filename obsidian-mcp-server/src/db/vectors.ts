import * as sqliteVec from "sqlite-vec";
import { getDb } from "./fts.js";

let vecInitialized = false;

export function initVec(vaultPath: string): void {
  if (vecInitialized) return;

  const db = getDb(vaultPath);
  sqliteVec.load(db);

  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS notes_vec USING vec0(
      path TEXT PRIMARY KEY,
      embedding FLOAT[768]
    );
  `);

  vecInitialized = true;
}

export function upsertVector(
  vaultPath: string,
  notePath: string,
  embedding: number[]
): void {
  initVec(vaultPath);
  const db = getDb(vaultPath);

  db.prepare("DELETE FROM notes_vec WHERE path = ?").run(notePath);
  db.prepare(
    "INSERT INTO notes_vec (path, embedding) VALUES (?, ?)"
  ).run(notePath, new Float32Array(embedding));
}

export function queryVector(
  vaultPath: string,
  embedding: number[],
  limit: number = 5
): Array<{ path: string; distance: number }> {
  initVec(vaultPath);
  const db = getDb(vaultPath);

  const rows = db
    .prepare(
      `SELECT path, distance
       FROM notes_vec
       WHERE embedding MATCH ?
       ORDER BY distance
       LIMIT ?`
    )
    .all(new Float32Array(embedding), limit) as Array<{
    path: string;
    distance: number;
  }>;

  return rows;
}

export function deleteVector(vaultPath: string, notePath: string): void {
  initVec(vaultPath);
  const db = getDb(vaultPath);
  db.prepare("DELETE FROM notes_vec WHERE path = ?").run(notePath);
}

export function updateVectorPath(
  vaultPath: string,
  oldPath: string,
  newPath: string,
  embedding: number[]
): void {
  deleteVector(vaultPath, oldPath);
  upsertVector(vaultPath, newPath, embedding);
}
