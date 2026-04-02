# Obsidian MCP Server — Design Spec
Date: 2026-04-02

## Overview

A standalone, reusable Node.js MCP server that gives Claude Code persistent, token-efficient access to any Obsidian vault. Configured via `VAULT_PATH` environment variable so a single installation serves multiple vaults. Each vault maintains its own SQLite database for full-text and vector search.

---

## Repository Structure

```
obsidian-mcp-server/
├── src/
│   ├── server.ts             ← MCP server entry point, tool registration
│   ├── tools/
│   │   ├── notes.ts          ← read_note, write_note, update_note
│   │   ├── search.ts         ← search_vault
│   │   ├── navigation.ts     ← list_notes, move_note
│   │   ├── projects.ts       ← create_project
│   │   └── index.ts          ← reindex_vault
│   ├── db/
│   │   ├── fts.ts            ← SQLite FTS5 schema, insert, query
│   │   └── vectors.ts        ← sqlite-vec schema, insert, cosine query
│   └── embeddings/
│       └── ollama.ts         ← Ollama HTTP client, nomic-embed-text
├── package.json
└── tsconfig.json
```

Each vault the server is pointed at stores its index at `<VAULT_PATH>/.vault-index.db`.

---

## Configuration

| Variable | Description |
|---|---|
| `VAULT_PATH` | Absolute path to the target Obsidian vault |

Set once in Claude Code's MCP server config per vault. No other configuration required.

---

## Tools

| Tool | Description |
|---|---|
| `read_note` | Read a note by path relative to vault root |
| `write_note` | Create a new note, auto-index it |
| `update_note` | Append, prepend, or replace-section content; re-index |
| `search_vault` | Hybrid FTS5 + vector semantic search, returns top N results with paths and excerpts (N configurable per call, default 5) |
| `list_notes` | List notes in a folder, optionally recursive |
| `move_note` | Move or rename a note, update index |
| `create_project` | Scaffold `02-projects/<name>/` with standard starter files |
| `reindex_vault` | Full vault crawl, rebuild FTS5 and vector index; skips unchanged files via mtime |

---

## Data Flow

### Write path
1. Write markdown file to disk
2. Strip frontmatter, extract plain text
3. Send text to Ollama → receive embedding vector
4. Upsert into FTS5 table and vector table in `.vault-index.db`

### Search path
1. Embed the query string via Ollama
2. Run FTS5 keyword query and vector cosine similarity query in parallel
3. Merge and deduplicate results; vector hits ranked higher for semantic queries, FTS5 hits ranked higher for exact term matches
4. Return top N results (default 5, caller-specified): file path + short excerpt
5. Claude calls `read_note` only on relevant results — this is the token efficiency mechanism

### Reindex path
1. Walk all `.md` files recursively in vault
2. For each file: compare mtime against stored value — skip if unchanged
3. Embed and upsert changed/new files
4. Return summary: N indexed, M skipped

---

## Dependencies

| Package | Purpose |
|---|---|
| `@modelcontextprotocol/sdk` | MCP server framework |
| `better-sqlite3` | SQLite driver (FTS5 + sqlite-vec) |
| `sqlite-vec` | Vector similarity extension for SQLite |
| `tsx` | Run TypeScript directly without build step in dev |
| `typescript` | Language |

**External:** Ollama must be running locally with `nomic-embed-text` pulled.

---

## Error Handling

- **Ollama unreachable at startup:** Server starts normally, vector search disabled, FTS5-only mode active, warning logged per search call.
- **Note not found:** `read_note` / `update_note` return a clear error message, no crash.
- **Invalid vault path:** Server fails fast at startup with a descriptive error.
- **Reindex on empty vault:** Runs cleanly, returns "0 notes indexed".

---

## Out of Scope

- Multi-vault simultaneous access (one `VAULT_PATH` per server instance)
- Note deletion (per vault rules: move to `00-inbox/` instead)
- Web UI or dashboard
- Automatic background sync / file watching
