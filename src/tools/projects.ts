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
`;

  await writeNote(vaultPath, `${projectPath}/README.md`, readme);
  await writeNote(vaultPath, `${projectPath}/notes.md`, notes);
  await writeNote(vaultPath, `${projectPath}/issues/active/.gitkeep`, "");
  await writeNote(vaultPath, `${projectPath}/issues/done/.gitkeep`, "");

  return `Created project at ${projectPath}/ with README.md, notes.md, issues/active/, and issues/done/`;
}
