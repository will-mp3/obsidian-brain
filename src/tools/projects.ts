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

  await writeNote(vaultPath, `${projectPath}/README.md`, readme);
  await writeNote(vaultPath, `${projectPath}/notes/.gitkeep`, "");
  await writeNote(vaultPath, `${projectPath}/issues/active/.gitkeep`, "");
  await writeNote(vaultPath, `${projectPath}/issues/done/.gitkeep`, "");

  return `Created project at ${projectPath}/ with README.md, notes/, issues/active/, and issues/done/`;
}
