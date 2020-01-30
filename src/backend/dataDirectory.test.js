// @flow

import deepFreeze from "deep-freeze";
import tmp from "tmp";
import path from "path";
import fs from "fs-extra";
import Database from "better-sqlite3";
import {createProject, projectToJSON, encodeProjectId} from "../core/project";
import {type CacheProvider} from "./cache";
import {type ProjectStorageProvider} from "./projectStorage";
import {DataDirectory} from "./dataDirectory";
import * as WeightedGraph from "../core/weightedGraph";

const project = createProject({id: "testing-project"});

const fakeWeightedGraph = deepFreeze(WeightedGraph.empty());

const fakeCred = ({
  toJSON: () => ({is: "fake-cred"}),
}: any);

const fakeExtras = {
  weightedGraph: fakeWeightedGraph,
  cred: fakeCred,
};

describe("src/backend/dataDirectory", () => {
  describe("DataDirectory", () => {
    it("should be a CacheProvider", () => {
      const _ = (x: DataDirectory): CacheProvider => x;
    });
    it("should be a ProjectStorageProvider", () => {
      const _ = (x: DataDirectory): ProjectStorageProvider => x;
    });

    describe("DataDirectory.database", () => {
      it("should create SQLite DB in the cache directory", async () => {
        // Given
        const sourcecredDirectory = tmp.dirSync().name;
        const id = "test-db-id";

        // When
        const data = new DataDirectory(sourcecredDirectory);
        const db = await data.database(id);

        // Then
        expect(db).toBeInstanceOf(Database);
        const dbFile = path.join(sourcecredDirectory, "cache", `${id}.db`);
        await fs.stat(dbFile);
      });

      it("should work when sourcecredDirectory doesn't exist", async () => {
        // Given
        const sourcecredDirectory = path.join(
          tmp.dirSync().name,
          "sourcecred_data_test"
        );
        const id = "test-db-id";

        // When
        const data = new DataDirectory(sourcecredDirectory);
        const db = await data.database(id);

        // Then
        expect(db).toBeInstanceOf(Database);
        const dbFile = path.join(sourcecredDirectory, "cache", `${id}.db`);
        await fs.stat(dbFile);
      });

      it("should fail when sourcecredDirectory is a file", async () => {
        // Given
        const sourcecredDirectory = path.join(
          tmp.dirSync().name,
          "sourcecred_data_test"
        );
        await fs.writeFile(sourcecredDirectory, "blocking file");
        const id = "test-db-id";

        // When
        const data = new DataDirectory(sourcecredDirectory);
        const p = data.database(id);

        // Then
        await expect(p).rejects.toThrow("ENOTDIR:");
      });
    });

    describe("DataDirectory.storeProject", () => {
      it("should populate a project directory", async () => {
        // Given
        const sourcecredDirectory = tmp.dirSync().name;

        // When
        const data = new DataDirectory(sourcecredDirectory);
        await data.storeProject(project, fakeExtras);

        // Then
        const expectedProjectDirectory = path.join(
          sourcecredDirectory,
          "projects",
          encodeProjectId(project.id)
        );
        const expectJSONFile = async (name: string, expected: any) => {
          const filePath = path.join(expectedProjectDirectory, name);
          const actual = JSON.parse(await fs.readFile(filePath));
          expect(actual).toEqual(expected);
        };
        await expectJSONFile("project.json", projectToJSON(project));
        await expectJSONFile(
          "weightedGraph.json",
          WeightedGraph.toJSON(fakeWeightedGraph)
        );
        await expectJSONFile("cred.json", fakeCred.toJSON());
      });

      it("should work when sourcecredDirectory doesn't exist", async () => {
        // Given
        const sourcecredDirectory = path.join(
          tmp.dirSync().name,
          "sourcecred_data_test"
        );

        // When
        const data = new DataDirectory(sourcecredDirectory);
        await data.storeProject(project, fakeExtras);

        // Then
        const expectedProjectDirectory = path.join(
          sourcecredDirectory,
          "projects",
          encodeProjectId(project.id)
        );
        const expectJSONFile = async (name: string, expected: any) => {
          const filePath = path.join(expectedProjectDirectory, name);
          const actual = JSON.parse(await fs.readFile(filePath));
          expect(actual).toEqual(expected);
        };
        await expectJSONFile("project.json", projectToJSON(project));
        await expectJSONFile(
          "weightedGraph.json",
          WeightedGraph.toJSON(fakeWeightedGraph)
        );
        await expectJSONFile("cred.json", fakeCred.toJSON());
      });

      it("should fail when sourcecredDirectory is a file", async () => {
        // Given
        const sourcecredDirectory = path.join(
          tmp.dirSync().name,
          "sourcecred_data_test"
        );
        await fs.writeFile(sourcecredDirectory, "blocking file");

        // When
        const data = new DataDirectory(sourcecredDirectory);
        const p = data.storeProject(project, fakeExtras);

        // Then
        await expect(p).rejects.toThrow("ENOTDIR:");
      });
    });
  });
});
