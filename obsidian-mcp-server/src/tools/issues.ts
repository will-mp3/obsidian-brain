import {
  insertIssue,
  updateIssue as dbUpdateIssue,
  listIssues as dbListIssues,
  getIssue,
  type IssueStatus,
  type IssueType,
  type Issue,
} from "../db/issues.js";
import { writeNote, updateNote } from "./notes.js";

const STATUS_LABELS: Record<IssueStatus, string> = {
  backlog: "Backlog",
  not_started: "Not Started",
  in_progress: "In Progress",
  code_review: "Code Review",
  done: "Done",
  blocked: "Blocked",
};

const PRIORITY_LABELS: Record<number, string> = {
  1: "Critical",
  2: "High",
  3: "Medium",
  4: "Low",
  5: "Trivial",
};

function issueToMarkdown(issue: Issue, body: string): string {
  return `---
id: ${issue.id}
type: ${issue.type}
status: ${issue.status}
priority: ${issue.priority}
project: ${issue.project ?? "none"}
created: ${issue.created_at}
updated: ${issue.updated_at}
---

# ${issue.title}

**Status:** ${STATUS_LABELS[issue.status as IssueStatus]} | **Priority:** P${issue.priority} (${PRIORITY_LABELS[issue.priority]}) | **Type:** ${issue.type}

## Description

${body}

## Notes

`;
}

function formatIssueList(issues: Issue[]): string {
  if (issues.length === 0) return "No issues found.";

  const lines = issues.map(
    (i) =>
      `#${i.id} [P${i.priority}] [${i.status}] (${i.type}) ${i.title}${i.project ? ` — ${i.project}` : ""}`
  );

  return lines.join("\n");
}

export async function createIssue(
  vaultPath: string,
  title: string,
  type: IssueType,
  priority: number,
  description: string = "",
  project?: string
): Promise<string> {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const folder = project
    ? `02-projects/${project}/issues`
    : `meta/issues`;
  const notePath = `${folder}/${type}-${slug}.md`;

  const issue = insertIssue(vaultPath, title, type, priority, notePath, project);
  const markdown = issueToMarkdown(issue, description);

  await writeNote(vaultPath, notePath, markdown);

  return `Created issue #${issue.id}: ${title} [P${priority}] [${type}]\nNote: ${notePath}`;
}

export async function updateIssueStatus(
  vaultPath: string,
  id: number,
  fields: {
    status?: IssueStatus;
    priority?: number;
    title?: string;
    project?: string;
    notes?: string;
  }
): Promise<string> {
  const issue = getIssue(vaultPath, id);
  if (!issue) return `Error: Issue #${id} not found`;

  const updated = dbUpdateIssue(vaultPath, id, fields);
  if (!updated) return `Error: Failed to update issue #${id}`;

  // Update the frontmatter in the note
  const frontmatter = `---
id: ${updated.id}
type: ${updated.type}
status: ${updated.status}
priority: ${updated.priority}
project: ${updated.project ?? "none"}
created: ${updated.created_at}
updated: ${updated.updated_at}
---`;

  // Update the status line in the note body
  const statusLine = `**Status:** ${STATUS_LABELS[updated.status as IssueStatus]} | **Priority:** P${updated.priority} (${PRIORITY_LABELS[updated.priority]}) | **Type:** ${updated.type}`;

  // If notes were provided, append them
  if (fields.notes) {
    const timestamp = new Date().toISOString().split("T")[0];
    await updateNote(
      vaultPath,
      updated.note_path,
      `- ${timestamp}: ${fields.notes}`,
      "append"
    );
  }

  const changes: string[] = [];
  if (fields.status) changes.push(`status → ${fields.status}`);
  if (fields.priority) changes.push(`priority → P${fields.priority}`);
  if (fields.title) changes.push(`title → ${fields.title}`);
  if (fields.project) changes.push(`project → ${fields.project}`);
  if (fields.notes) changes.push(`added note`);

  return `Updated issue #${id}: ${changes.join(", ")}`;
}

export async function listFilteredIssues(
  vaultPath: string,
  filters: {
    status?: IssueStatus | IssueStatus[];
    type?: IssueType;
    priority?: number;
    project?: string;
  } = {}
): Promise<string> {
  const issues = dbListIssues(vaultPath, filters);
  return formatIssueList(issues);
}
