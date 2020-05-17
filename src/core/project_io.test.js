// @flow

import deepFreeze from "deep-freeze";
import tmp from "tmp";
import path from "path";
import fs from "fs-extra";

import {
  type Project,
  encodeProjectId,
  projectToJSON,
  createProject,
} from "./project";

import {
  getProjectIds,
  setupProjectDirectory,
  directoryForProjectId,
  loadProject,
} from "./project_io";

import {makeRepoId} from "../plugins/github/repoId";

describe("core/project_io", () => {
  const foobar = deepFreeze(makeRepoId("foo", "bar"));
  const foozod = deepFreeze(makeRepoId("foo", "zod"));
  const p1: Project = deepFreeze(
    createProject({
      id: "foo/bar",
      repoIds: [foobar],
    })
  );
  // Note: the point of P2 is to use all project options.
  // So we're avoiding createProject, to not forget new options.
  const p2: Project = deepFreeze({
    id: "@foo",
    repoIds: [foobar, foozod],
    discourseServer: {serverUrl: "https://example.com"},
    identities: [{username: "foo", aliases: ["github/foo", "discourse/foo"]}],
    initiatives: {remoteUrl: "https://example.com/initiatives"},
    params: {alpha: 0.2, intervalDecay: 0.5},
  });

  it("setupProjectDirectory results in a loadable project", async () => {
    const sourcecredDirectory = tmp.dirSync().name;
    await setupProjectDirectory(p1, sourcecredDirectory);
    const ps = await getProjectIds(sourcecredDirectory);
    expect(ps).toEqual([p1.id]);
    expect(await loadProject(p1.id, sourcecredDirectory)).toEqual(p1);
  });
  it("setupProjectDirectory twice results in two loadable projects", async () => {
    const sourcecredDirectory = tmp.dirSync().name;
    await setupProjectDirectory(p1, sourcecredDirectory);
    await setupProjectDirectory(p2, sourcecredDirectory);
    const ps = await getProjectIds(sourcecredDirectory);
    expect(ps).toHaveLength(2);
    expect(ps.slice().sort()).toEqual([p2.id, p1.id]);
    expect(await loadProject(p1.id, sourcecredDirectory)).toEqual(p1);
    expect(await loadProject(p2.id, sourcecredDirectory)).toEqual(p2);
  });
  it("getProjectIds returns no projects if none were setup", async () => {
    const sourcecredDirectory = tmp.dirSync().name;
    const ps = await getProjectIds(sourcecredDirectory);
    expect(ps).toHaveLength(0);
  });
  it("setupProjectDirectory returns the right directory", async () => {
    const sourcecredDirectory = tmp.dirSync().name;
    const dir = await setupProjectDirectory(p1, sourcecredDirectory);
    expect(dir).toEqual(directoryForProjectId(p1.id, sourcecredDirectory));
    const projectJsonPath = path.join(dir, "project.json");
    await fs.stat(projectJsonPath);
  });
  it("projects can be accessed using the encoded ID", async () => {
    // Necessary so that frontend consumers can locate the project via the file mirror API
    const sourcecredDirectory = tmp.dirSync().name;
    await setupProjectDirectory(p1, sourcecredDirectory);
    const projectJsonPath = path.join(
      sourcecredDirectory,
      "projects",
      encodeProjectId(p1.id),
      "project.json"
    );
    await fs.stat(projectJsonPath);
  });
  it("getProjectIds ignores non-project subdirectories", async () => {
    const sourcecredDirectory = tmp.dirSync().name;
    await setupProjectDirectory(p1, sourcecredDirectory);
    await fs.mkdirp(path.join(sourcecredDirectory, "projects", "foobar"));
    const ps = await getProjectIds(sourcecredDirectory);
    expect(ps).toEqual([p1.id]);
  });
  it("getProjectIds ignores non-project file entries", async () => {
    const sourcecredDirectory = tmp.dirSync().name;
    await setupProjectDirectory(p1, sourcecredDirectory);
    fs.writeFileSync(
      path.join(sourcecredDirectory, "projects", "foobar"),
      "1234"
    );
    const ps = await getProjectIds(sourcecredDirectory);
    expect(ps).toEqual([p1.id]);
  });
  it("loadProject throws an error on inconsistent id", async () => {
    const sourcecredDirectory = tmp.dirSync().name;
    const projectDirectory = await setupProjectDirectory(
      p1,
      sourcecredDirectory
    );
    const jsonPath = path.join(projectDirectory, "project.json");
    const badJson = projectToJSON(p2);
    fs.writeFileSync(jsonPath, JSON.stringify(badJson));
    expect.assertions(1);
    return loadProject(p1.id, sourcecredDirectory).catch((e) =>
      expect(e.message).toMatch(`project ${p2.id} saved under id ${p1.id}`)
    );
  });
  it("loadProject throws an error on bad compat", async () => {
    const sourcecredDirectory = tmp.dirSync().name;
    const projectDirectory = await setupProjectDirectory(
      p1,
      sourcecredDirectory
    );
    const jsonPath = path.join(projectDirectory, "project.json");
    const badJson = [{type: "sourcecred/project", version: "NaN"}, {}];
    fs.writeFileSync(jsonPath, JSON.stringify(badJson));
    expect.assertions(1);
    return loadProject(p1.id, sourcecredDirectory).catch((e) =>
      expect(e.message).toMatch(`tried to load unsupported version`)
    );
  });
  it("loadProject fails when no project ever saved", async () => {
    const sourcecredDirectory = tmp.dirSync().name;
    return loadProject(p1.id, sourcecredDirectory).catch((e) =>
      expect(e).toMatch(`project ${p1.id} not loaded`)
    );
  });
  it("loadProject fails when a different project was saved", async () => {
    const sourcecredDirectory = tmp.dirSync().name;
    await setupProjectDirectory(p2, sourcecredDirectory);
    return loadProject(p1.id, sourcecredDirectory).catch((e) =>
      expect(e).toMatch(`project ${p1.id} not loaded`)
    );
  });
});
