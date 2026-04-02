# Obsidian MCP Server — Implementation Plan
Date: 2026-04-02

## Phase 1: Project Scaffolding

### Step 1.1 — Initialize the project
- Create `obsidian-mcp-server/` directory at repo root
- `npm init` with name `obsidian-mcp-server`
- Install dependencies: `@modelcontextprotocol/sdk`, `better-sqlite3`, `sqlite-vec`, `tsx`, `typescript`
- Install dev dependencies: `@types/better-sqlite3`, `@types/node`
- Create `tsconfig.json` with `"strict": true`, target ES2022, module NodeNext
- Create `src/` directory structure per spec:
  - `src/server.ts`
  - `src/tools/notes.ts`
  - `src/tools/search.ts`
  - `src/tools/navigation.ts`
  - `src/tools/projects.ts`
  - `src/tools/index.ts`
  - `src/db/fts.ts`
  - `src/db/vectors.ts`
  - `src/embeddings/ollama.ts`

### Step 1.2 — Server entry point skeleton
- File: `src/server.ts`
- Read `VAULT_PATH` from environment, fail fast if missing or path doesn't exist
- Initialize MCP server using `@modelcontextprotocol/sdk`
- Register all 8 tools (empty handlers initially)
- Add `package.json` script: `"start": "tsx src/server.ts"`
- **Verify:** Server starts, connects via stdio, lists tools

---

## Phase 2: Database Layer

### Step 2.1 — FTS5 module
- File: `src/db/fts.ts`
- Open/create SQLite DB at `<VAULT_PATH>/.vault-index.db`
- Create FTS5 virtual table: `notes_fts(path, title, content)`
- Create metadata table: `notes_meta(path PRIMARY KEY, mtime INTEGER)`
- Export functions: `upsertFTS(path, title, content, mtime)`, `queryFTS(term, limit)`, `getMtime(path)`, `deleteFTS(path)`
- **Verify:** Unit test — insert a doc, query it, get results back

### Step 2.2 — Vector module
- File: `src/db/vectors.ts`
- Load `sqlite-vec` extension into the same DB connection
- Create virtual table: `notes_vec` using `vec0` with 768 dimensions (nomic-embed-text output size)
- Export functions: `upsertVector(path, embedding)`, `queryVector(embedding, limit)`, `deleteVector(path)`
- **Verify:** Insert a dummy 768-dim vector, query nearest neighbor

---

## Phase 3: Embeddings

### Step 3.1 — Ollama client
- File: `src/embeddings/ollama.ts`
- HTTP POST to `http://localhost:11434/api/embed` with model `nomic-embed-text`
- Export: `embed(text: string): Promise<number[] | null>`
- On connection error: return `null` (graceful degradation)
- Export: `isOllamaAvailable(): boolean` flag set on first call attempt
- **Verify:** Call with sample text, confirm 768-dim array returned

---

## Phase 4: Tools Implementation

### Step 4.1 — `read_note`
- File: `src/tools/notes.ts`
- Input: `{ path: string }` (relative to vault root)
- Read file from `VAULT_PATH/<path>`, return contents
- If file not found, return error message (no throw)

### Step 4.2 — `write_note`
- File: `src/tools/notes.ts`
- Input: `{ path: string, content: string }`
- Write markdown file to disk
- Strip frontmatter, extract plain text
- Embed via Ollama (skip vector insert if unavailable)
- Upsert into FTS5 + vector tables
- Return confirmation with path

### Step 4.3 — `update_note`
- File: `src/tools/notes.ts`
- Input: `{ path: string, content: string, mode: "append" | "prepend" | "replace-section", section?: string }`
- Read existing file, apply modification based on mode
- For `replace-section`: find `## <section>` header, replace content until next heading
- Write back, re-index (FTS5 + vector)
- Return confirmation

### Step 4.4 — `search_vault`
- File: `src/tools/search.ts`
- Input: `{ query: string, limit?: number }` (default limit 5)
- Run FTS5 query and vector cosine query in parallel (`Promise.all`)
- If Ollama unavailable, FTS5 only
- Merge results: deduplicate by path, interleave rankings
- Return array of `{ path, excerpt, score }`

### Step 4.5 — `list_notes`
- File: `src/tools/navigation.ts`
- Input: `{ folder?: string, recursive?: boolean }`
- Walk directory, filter `.md` files
- Return array of relative paths

### Step 4.6 — `move_note`
- File: `src/tools/navigation.ts`
- Input: `{ from: string, to: string }`
- Rename/move file on disk
- Update path in FTS5 and vector tables (delete old, insert new with same content)
- Return confirmation

### Step 4.7 — `create_project`
- File: `src/tools/projects.ts`
- Input: `{ name: string }`
- Create `02-projects/<name>/` directory
- Scaffold starter files (e.g., `README.md`, `notes.md`) — keep minimal
- Index created files
- Return confirmation with paths created

### Step 4.8 — `reindex_vault`
- File: `src/tools/index.ts`
- Walk all `.md` files recursively
- For each: compare mtime against stored value, skip if unchanged
- Embed and upsert changed/new files
- Return summary: `{ indexed: N, skipped: M }`
- **Verify:** Run against a test vault, confirm counts

---

## Phase 5: Wire Up & Integration Test

### Step 5.1 — Connect tool handlers to server
- File: `src/server.ts`
- Import all tool functions, wire each to its MCP tool registration
- Ensure proper input schema validation via MCP SDK's built-in zod support

### Step 5.2 — End-to-end test
- Create a temp vault directory with a few `.md` files
- Start server with `VAULT_PATH` pointing to temp vault
- Test sequence: `reindex_vault` → `search_vault` → `read_note` → `write_note` → `search_vault` (find new note) → `move_note` → `list_notes`
- Confirm all operations work correctly

### Step 5.3 — MCP config entry
- Add server to Claude Code MCP config:
```json
{
  "mcpServers": {
    "obsidian": {
      "command": "npx",
      "args": ["tsx", "<path>/src/server.ts"],
      "env": { "VAULT_PATH": "/path/to/vault" }
    }
  }
}
```
- Verify Claude Code discovers and can call all 8 tools

---

## Implementation Order Summary

1. **Phase 1** — Scaffolding + server skeleton (foundation)
2. **Phase 2** — Database layer (FTS5, then vectors)
3. **Phase 3** — Ollama embeddings client
4. **Phase 4** — Tools (4.1→4.8 in order, each builds on prior)
5. **Phase 5** — Wire up, integration test, MCP config
