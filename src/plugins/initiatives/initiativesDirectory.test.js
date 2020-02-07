// @flow

import tmp from "tmp";
import path from "path";
import fs from "fs-extra";
import {NodeAddress} from "../../core/graph";
import {createId, addressFromId} from "./initiative";
import {
  type InitiativeFile,
  type InitiativesDirectory,
  fromJSON,
  toJSON,
  initiativeFileURL,
  _initiativeFileId,
  _validatePath,
  _findFiles,
  _readFiles,
} from "./initiativesDirectory";

const exampleInitiativeFile = (): InitiativeFile => ({
  title: "Sample initiative",
  timestampIso: ("2020-01-08T22:01:57.766Z": any),
  completed: false,
  champions: ["http://foo.bar/champ"],
  contributions: ["http://foo.bar/contrib"],
  dependencies: ["http://foo.bar/dep"],
  references: ["http://foo.bar/ref"],
});

describe("plugins/initiatives/initiativesDirectory", () => {
  describe("toJSON/fromJSON", () => {
    it("should handle an example round-trip", () => {
      // Given
      const initiativeFile = exampleInitiativeFile();

      // When
      const actual = fromJSON(toJSON(initiativeFile));

      // Then
      expect(actual).toEqual(initiativeFile);
    });
  });

  describe("initiativeFileURL", () => {
    it("should return null for a different prefix", () => {
      // Given
      const address = NodeAddress.fromParts(["foobar"]);

      // When
      const url = initiativeFileURL(address);

      // Then
      expect(url).toEqual(null);
    });

    it("should detect the correct prefix and create a URL", () => {
      // Given
      const remoteUrl = "http://foo.bar/dir";
      const fileName = "sample.json";
      const address = addressFromId(
        createId("INITIATIVE_FILE", remoteUrl, fileName)
      );

      // When
      const url = initiativeFileURL(address);

      // Then
      expect(url).toEqual(`${remoteUrl}/${fileName}`);
    });
  });

  describe("_initiativeFileId", () => {
    it("should add the correct prefix to a remoteUrl and fileName", () => {
      // Given
      const dir: InitiativesDirectory = {
        localPath: "should-not-be-used",
        remoteUrl: "http://foo.bar/dir",
      };
      const fileName = "sample.json";

      // When
      const id = _initiativeFileId(dir, fileName);

      // Then
      expect(id).toEqual(createId("INITIATIVE_FILE", dir.remoteUrl, fileName));
    });
  });

  describe("_validatePath", () => {
    it("should resolve relative paths", async () => {
      // Given
      const localPath = `${__dirname}/./test/../example/`;

      // When
      const actual = await _validatePath(localPath);

      // Then
      expect(actual).toEqual(path.join(__dirname, "example"));
    });

    it("should throw when directory doesn't exist", async () => {
      // Given
      const localPath = path.join(tmp.dirSync().name, "findFiles_test");

      // When
      const p = _validatePath(localPath);

      // Then
      await expect(p).rejects.toThrow(
        `Provided initiatives directory does not exist at: ${localPath}`
      );
    });

    it("should throw when directory is not a directory", async () => {
      // Given
      const localPath = path.join(tmp.dirSync().name, "findFiles_test");
      await fs.writeFile(localPath, "");

      // When
      const p = _validatePath(localPath);

      // Then
      await expect(p).rejects.toThrow(
        `Provided initiatives directory is not a directory at: ${localPath}`
      );
    });
  });

  describe("_findFiles", () => {
    it("should locate all *.json files in a local path", async () => {
      // Given
      const localPath = path.join(__dirname, "example");

      // When
      const fileNames = await _findFiles(localPath);

      // Then
      // Shallow copy to sort, because the array is read-only.
      const actualNames = [...fileNames].sort();
      expect(actualNames).toEqual(["initiative-A.json", "initiative-B.json"]);
    });
  });

  describe("_readFiles", () => {
    it("should read provided initiativeFiles, sorted by name", async () => {
      // Given
      const localPath = path.join(__dirname, "example");
      const fileNames = ["initiative-B.json", "initiative-A.json"];

      // When
      const map = await _readFiles(localPath, fileNames);

      // Then
      expect([...map.keys()]).toEqual([
        "initiative-A.json",
        "initiative-B.json",
      ]);
      expect(map).toMatchSnapshot();
    });

    it("should throw when directory doesn't exist", async () => {
      // Given
      const localPath = path.join(tmp.dirSync().name, "findFiles_test");
      const fileNames = ["initiative-B.json", "initiative-A.json"];

      // When
      const p = _readFiles(localPath, fileNames);

      // Then
      await expect(p).rejects.toThrow("Could not find Initiative file at:");
    });

    it("should throw when directory is not a directory", async () => {
      // Given
      const localPath = path.join(tmp.dirSync().name, "findFiles_test");
      const fileNames = ["initiative-B.json", "initiative-A.json"];
      await fs.writeFile(localPath, "");

      // When
      const p = _readFiles(localPath, fileNames);

      // Then
      await expect(p).rejects.toThrow("Could not find Initiative file at:");
    });
  });
});
