# Vault Templates — Design Spec

## Problem

The vault has no standardized note templates. `create_project` hardcodes a minimal scaffold, and `CLAUDE.md` references `/templates/` which doesn't exist. Notes created ad-hoc will drift in structure, making search and `update_note` (replace-section) unreliable.

## Decision

Vault-side templates stored in `meta/templates/`. No server code changes. Claude reads the relevant template before creating any note, fills in placeholders, and writes via `write_note`.

## Template Location

```
meta/templates/
  project.md
  idea.md
  research.md
  knowledge.md
  issue.md
  meeting.md
```

## Template Format

Every template follows this structure:

1. **YAML frontmatter** with `type`, `status`, `created` (plus type-specific fields)
2. **H1 title** using `{{name}}` placeholder
3. **Flat H2 sections** — no nesting beyond H2
4. **HTML comment hints** after headings — e.g. `<!-- one sentence -->`

No tables, checkboxes, or rich formatting. Optimized for `replace-section` targeting.

## Templates

### project.md

```markdown
---
type: project
status: active
created: {{date}}
---
# {{name}}

## Overview
<!-- what this project is and why it exists -->

## Goals
<!-- bulleted list of success criteria -->

## Architecture
<!-- components, tools, key decisions -->

## Status
<!-- current state: active, paused, complete -->

## Log
<!-- reverse-chronological entries: YYYY-MM-DD — what happened -->
```

### idea.md

```markdown
---
type: idea
status: raw
created: {{date}}
---
# {{name}}

## Summary
<!-- one paragraph: what is this idea -->

## Motivation
<!-- why this matters -->

## Open Questions
<!-- what needs answering before this becomes a project -->

## Next Steps
<!-- concrete actions to explore further -->
```

### research.md

```markdown
---
type: research
status: draft
created: {{date}}
---
# {{name}}

## Source
<!-- where this information comes from: URLs, papers, people -->

## Summary
<!-- key takeaway in 2-3 sentences -->

## Key Findings
<!-- bulleted facts or claims worth retaining -->

## Implications
<!-- how this connects to active projects or decisions -->
```

### knowledge.md

```markdown
---
type: knowledge
status: draft
created: {{date}}
---
# {{name}}

## Definition
<!-- what this concept is, precisely -->

## Context
<!-- when and why this matters -->

## Connections
<!-- wikilinks to related notes -->
```

### issue.md

```markdown
---
type: issue
status: not_started
priority: {{priority}}
issue-type: {{issue-type}}
created: {{date}}
---
# {{name}}

## Description
<!-- what is wrong or what needs to happen -->

## Steps to Reproduce
<!-- if bug: numbered steps. if task/feature: remove this section -->

## Acceptance Criteria
<!-- how to verify this is done -->

## Log
<!-- reverse-chronological: YYYY-MM-DD — progress notes -->
```

### meeting.md

```markdown
---
type: meeting
date: {{date}}
created: {{date}}
---
# {{name}}

## Attendees
<!-- who was present -->

## Agenda
<!-- topics covered -->

## Decisions
<!-- what was decided and why -->

## Action Items
<!-- who does what by when -->
```

## Placeholders

| Placeholder | Filled with |
|---|---|
| `{{name}}` | Note title provided by user |
| `{{date}}` | ISO date (YYYY-MM-DD) at creation time |
| `{{priority}}` | P1-P5 (issue only) |
| `{{issue-type}}` | bug, feature, or task (issue only) |

## CLAUDE.md Changes

Replace the current "Use templates" rule with:

```
- **Use templates.** Before creating any note, read the matching template from meta/templates/.
  Fill in {{name}} with the note title and {{date}} with today's date.
  Write the filled template via write_note. Do not create notes without a template.
```

## What Does NOT Change

- No MCP server code modifications
- `create_project` continues to work as-is (can be updated later to use the template)
- No new MCP tools
- Issue tracking tools (`create_issue`, `update_issue`) are unaffected — the issue template is for manual issue creation via `write_note`

## Future Considerations

- If the extra `read_note` call per creation becomes annoying, migrate to hybrid approach (server reads templates at startup)
- `create_project` could be updated to read `meta/templates/project.md` instead of its hardcoded scaffold
