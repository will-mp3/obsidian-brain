import { writeNote } from "./notes.js";

export async function createProject(
  vaultPath: string,
  name: string
): Promise<string> {
  const projectPath = `02-projects/${name}`;

  const readme = `# ${name}

## Overview

## Goals

## Status
- [ ] In progress

## Notes
`;

  const notes = `# ${name} — Notes

## Log
`;

  await writeNote(vaultPath, `${projectPath}/README.md`, readme);
  await writeNote(vaultPath, `${projectPath}/notes.md`, notes);

  return `Created project at ${projectPath}/ with README.md and notes.md`;
}
