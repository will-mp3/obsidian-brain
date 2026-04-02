# Obsidian MCP Server

A Node.js MCP server that gives Claude Code persistent, token-efficient access to any Obsidian vault. Includes hybrid full-text + semantic search and built-in issue tracking.

## Prerequisites

- Node.js 18+
- [Ollama](https://ollama.com) running locally with `nomic-embed-text` pulled (optional -- server works without it, FTS-only mode)

```bash
ollama pull nomic-embed-text
```

## Setup

```bash
cd obsidian-mcp-server
npm install
```

Add to your Claude Code MCP config (`~/.claude/settings.json` or project-level):

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "npx",
      "args": ["tsx", "/path/to/obsidian-mcp-server/src/server.ts"],
      "env": { "VAULT_PATH": "/path/to/your/vault" }
    }
  }
}
```

One server instance per vault. Set `VAULT_PATH` to the vault root.

## Tools

### Notes

| Tool | Description |
|---|---|
| `read_note` | Read a note by path relative to vault root |
| `write_note` | Create a new note, auto-indexes it |
| `update_note` | Append, prepend, or replace a section; re-indexes |
| `move_note` | Move or rename a note, updates index |
| `list_notes` | List notes in a folder, optionally recursive |

### Search

| Tool | Description |
|---|---|
| `search_vault` | Hybrid FTS5 + vector semantic search. Returns top N results with paths and excerpts (default 5) |
| `reindex_vault` | Full vault crawl, rebuilds FTS5 and vector index. Skips unchanged files via mtime |

### Projects

| Tool | Description |
|---|---|
| `create_project` | Scaffold `02-projects/<name>/` with starter files |

### Issue Tracking

| Tool | Description |
|---|---|
| `create_issue` | Create a tracked issue with type, priority, and description. Stored as a note in the project's `issues/` folder |
| `update_issue` | Change status, priority, or append progress notes |
| `list_issues` | Filter issues by status, type, priority, or project. Sorted by priority |

**Statuses:** backlog, not_started, in_progress, code_review, done, blocked

**Priorities:** P1 (critical), P2 (high), P3 (medium), P4 (low), P5 (trivial)

**Types:** bug, feature, task

## Vault Structure

The server expects (and works with) this folder layout:

```
00-inbox/       -- unprocessed captures
01-ideas/       -- raw ideas
02-projects/    -- active projects (each in its own subfolder)
  <project>/
    issues/     -- project-scoped issues
03-research/    -- external knowledge by domain
04-knowledge/   -- refined long-term concepts
05-life/        -- personal planning
06-finance/     -- financial strategy
07-work/        -- professional material
meta/           -- system notes
  issues/       -- global issues (not tied to a project)
```

## How It Works

### Search

1. `reindex_vault` walks all `.md` files, strips frontmatter, embeds via Ollama, and stores in SQLite (FTS5 + sqlite-vec)
2. `search_vault` runs keyword (FTS5) and semantic (vector cosine) queries in parallel, merges and deduplicates results
3. Claude calls `read_note` only on relevant results -- this is the token efficiency mechanism

If Ollama is unavailable, the server falls back to FTS5-only search automatically.

### Issue Tracking

Issues are dual-stored:
- **Markdown note** in `02-projects/<project>/issues/` -- browsable in Obsidian, includes frontmatter metadata and a notes log
- **SQLite table** in `.vault-index.db` -- enables fast structured queries (filter by status, priority, type, project)

### Indexing

Each vault stores its index at `<VAULT_PATH>/.vault-index.db`. This file is generated and should not be committed to version control.

## CLAUDE.md

Place a `CLAUDE.md` at your vault root with instructions for Claude. It loads automatically each session. Example rules:

- Never delete notes -- move to `00-inbox/` if unsure
- Search before creating -- avoid duplicate notes
- Use the MCP tools instead of reading/writing files directly
- Respect folder roles

## Dependencies

| Package | Purpose |
|---|---|
| `@modelcontextprotocol/sdk` | MCP server framework |
| `better-sqlite3` | SQLite driver (FTS5) |
| `sqlite-vec` | Vector similarity extension for SQLite |
| `tsx` | Run TypeScript directly |
| `typescript` | Language |
