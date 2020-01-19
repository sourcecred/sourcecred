// @flow

import path from "path";
import fs from "fs-extra";
import Database from "better-sqlite3";
import stringify from "json-stable-stringify";
import {type Project, projectToJSON} from "../core/project";
import {directoryForProjectId} from "../core/project_io";
import {type CacheProvider} from "./cache";
import type {ProjectStorageProvider, ProjectStorageExtras} from "./project";

/**
 * Represents a SourceCred data directory.
 */
export class DataDirectory implements CacheProvider, ProjectStorageProvider {
  sourcecredDirectory: string;
  cacheDirectory: string;

  constructor(sourcecredDirectory: string) {
    this.sourcecredDirectory = sourcecredDirectory;
    this.cacheDirectory = path.join(sourcecredDirectory, "cache");
  }

  async database(id: string): Promise<Database> {
    await fs.mkdirp(this.cacheDirectory);
    const file = path.join(this.cacheDirectory, `${id}.db`);
    return new Database(file);
  }

  async storeProject(
    project: Project,
    {graph, cred}: ProjectStorageExtras
  ): Promise<void> {
    const projectDirectory = directoryForProjectId(
      project.id,
      this.sourcecredDirectory
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
