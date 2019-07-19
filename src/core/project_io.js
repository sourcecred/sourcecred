// @flow
// This module contains logic for loading/saving projects to the
// sourcecred directory.
//
// It is separated from project.js so that it's possible to depend on project
// logic independent from anything related to the filesystem. (Depending
// on the path or fs module in the frontend would create a build error.)

import fs from "fs-extra";
import path from "path";
import stringify from "json-stable-stringify";

import {
  type Project,
  type ProjectId,
  projectToJSON,
  projectFromJSON,
  encodeProjectId,
} from "./project";
import _getProjectIds from "./_getProjectIds";

/**
 * Get the ids for every project saved on the filesystem.
 *
 * It is not guaranteed that it will be possible to load the id in question.
 * (For example, the project may be malformed, or may have an outdated compat
 * version.)
 */
export function getProjectIds(
  sourcecredDirectory: string
): Promise<$ReadOnlyArray<ProjectId>> {
  return _getProjectIds(sourcecredDirectory);
}

/**
 * Returns the project directory for the given id.
 *
 * Does not guarantee that the project directory has been created;
 * does not do any IO.
 */
export function directoryForProjectId(
  id: ProjectId,
  sourcecredDirectory: string
): string {
  return path.join(sourcecredDirectory, "projects", encodeProjectId(id));
}

/**
 * Sets up a directory for the project, including a `project.json` file describing the project.
 *
 * If there is already a project.json file present, it will be over-written.
 *
 * Returns the project directory.
 */
export async function setupProjectDirectory(
  project: Project,
  sourcecredDirectory: string
): Promise<string> {
  const projectDirectory = directoryForProjectId(
    project.id,
    sourcecredDirectory
  );
  await fs.mkdirp(projectDirectory);
  const projectFile = path.join(projectDirectory, "project.json");
  await fs.writeFile(projectFile, stringify(projectToJSON(project)));
  return projectDirectory;
}

/**
 * Load the Project with given id from the sourcecred directory.
 *
 * This method may throw an error if the project is not present,
 * or is malformed or corrupted.
 */
export async function loadProject(
  id: ProjectId,
  sourcecredDirectory: string
): Promise<Project> {
  const directory = directoryForProjectId(id, sourcecredDirectory);
  const jsonPath = path.join(directory, "project.json");
  try {
    const contents = await fs.readFile(jsonPath);
    const project: Project = projectFromJSON(JSON.parse(contents));
    if (project.id !== id) {
      throw new Error(`project ${project.id} saved under id ${id}`);
    }
    return project;
  } catch (e) {
    if (e.message.startsWith("ENOENT:")) {
      throw `project ${id} not loaded`;
    }
    throw e;
  }
}
