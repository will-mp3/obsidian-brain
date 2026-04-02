import { getDb } from "./fts.js";

export type IssueStatus =
  | "backlog"
  | "not_started"
  | "in_progress"
  | "code_review"
  | "done"
  | "blocked";

export type IssueType = "bug" | "feature" | "task";

export interface Issue {
  id: number;
  title: string;
  type: IssueType;
  status: IssueStatus;
  priority: number;
  project: string | null;
  note_path: string;
  created_at: string;
  updated_at: string;
}

export function initIssuesTable(vaultPath: string): void {
  const db = getDb(vaultPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('bug', 'feature', 'task')),
      status TEXT NOT NULL DEFAULT 'not_started'
        CHECK(status IN ('backlog', 'not_started', 'in_progress', 'code_review', 'done', 'blocked')),
      priority INTEGER NOT NULL CHECK(priority BETWEEN 1 AND 5),
      project TEXT,
      note_path TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
    CREATE INDEX IF NOT EXISTS idx_issues_priority ON issues(priority);
    CREATE INDEX IF NOT EXISTS idx_issues_type ON issues(type);
    CREATE INDEX IF NOT EXISTS idx_issues_project ON issues(project);
  `);
}

export function insertIssue(
  vaultPath: string,
  title: string,
  type: IssueType,
  priority: number,
  notePath: string,
  project?: string
): Issue {
  initIssuesTable(vaultPath);
  const db = getDb(vaultPath);

  const result = db
    .prepare(
      `INSERT INTO issues (title, type, priority, note_path, project)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(title, type, priority, notePath, project ?? null);

  return db
    .prepare("SELECT * FROM issues WHERE id = ?")
    .get(result.lastInsertRowid) as Issue;
}

export function updateIssue(
  vaultPath: string,
  id: number,
  fields: {
    status?: IssueStatus;
    priority?: number;
    title?: string;
    project?: string;
  }
): Issue | null {
  initIssuesTable(vaultPath);
  const db = getDb(vaultPath);

  const sets: string[] = ["updated_at = datetime('now')"];
  const values: unknown[] = [];

  if (fields.status !== undefined) {
    sets.push("status = ?");
    values.push(fields.status);
  }
  if (fields.priority !== undefined) {
    sets.push("priority = ?");
    values.push(fields.priority);
  }
  if (fields.title !== undefined) {
    sets.push("title = ?");
    values.push(fields.title);
  }
  if (fields.project !== undefined) {
    sets.push("project = ?");
    values.push(fields.project);
  }

  values.push(id);

  db.prepare(`UPDATE issues SET ${sets.join(", ")} WHERE id = ?`).run(
    ...values
  );

  return db.prepare("SELECT * FROM issues WHERE id = ?").get(id) as
    | Issue
    | null;
}

export function listIssues(
  vaultPath: string,
  filters: {
    status?: IssueStatus | IssueStatus[];
    type?: IssueType;
    priority?: number;
    project?: string;
  } = {}
): Issue[] {
  initIssuesTable(vaultPath);
  const db = getDb(vaultPath);

  const conditions: string[] = [];
  const values: unknown[] = [];

  if (filters.status !== undefined) {
    if (Array.isArray(filters.status)) {
      const placeholders = filters.status.map(() => "?").join(", ");
      conditions.push(`status IN (${placeholders})`);
      values.push(...filters.status);
    } else {
      conditions.push("status = ?");
      values.push(filters.status);
    }
  }

  if (filters.type !== undefined) {
    conditions.push("type = ?");
    values.push(filters.type);
  }

  if (filters.priority !== undefined) {
    conditions.push("priority <= ?");
    values.push(filters.priority);
  }

  if (filters.project !== undefined) {
    conditions.push("project = ?");
    values.push(filters.project);
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  return db
    .prepare(
      `SELECT * FROM issues ${where} ORDER BY priority ASC, updated_at DESC`
    )
    .all(...values) as Issue[];
}

export function getIssue(vaultPath: string, id: number): Issue | null {
  initIssuesTable(vaultPath);
  const db = getDb(vaultPath);
  return db.prepare("SELECT * FROM issues WHERE id = ?").get(id) as
    | Issue
    | null;
}
