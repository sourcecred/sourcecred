// @flow

import path from "path";
import fs from "fs-extra";
import Database from "better-sqlite3";
import stringify from "json-stable-stringify";
import {type Project, projectToJSON} from "../core/project";
import {directoryForProjectId} from "../core/project_io";
import {type CacheProvider} from "./cache";
import type {
  ProjectStorageProvider,
  ProjectStorageExtras,
} from "./projectStorage";

/**
 * Represents a SourceCred data directory.
 */
export class DataDirectory implements CacheProvider, ProjectStorageProvider {
  +_sourcecredDirectory: string;
  +_cacheDirectory: string;

  constructor(sourcecredDirectory: string) {
    this._sourcecredDirectory = sourcecredDirectory;
    this._cacheDirectory = path.join(sourcecredDirectory, "cache");
  }

  async database(id: string): Promise<Database> {
    await fs.mkdirp(this._cacheDirectory);
    const file = path.join(this._cacheDirectory, `${id}.db`);
    return new Database(file);
  }

  async storeProject(
    project: Project,
    {graph, cred}: ProjectStorageExtras
  ): Promise<void> {
    const projectDirectory = directoryForProjectId(
      project.id,
      this._sourcecredDirectory
    );
    await fs.mkdirp(projectDirectory);
    const writeFile = async (name: string, data: string) => {
      const fileName = path.join(projectDirectory, name);
      await fs.writeFile(fileName, data);
    };
    writeFile("project.json", stringify(projectToJSON(project)));
    if (graph) writeFile("graph.json", stringify(graph.toJSON()));
    if (cred) writeFile("cred.json", stringify(cred.toJSON()));
  }
}
