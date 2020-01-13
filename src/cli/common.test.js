// @flow

import path from "path";
import tmp from "tmp";
import fs from "fs-extra";
import {defaultWeights, toJSON as weightsToJSON} from "../analysis/weights";
import {NodeAddress} from "../core/graph";
import {validateToken} from "../plugins/github/token";

import {
  defaultPlugins,
  defaultSourcecredDirectory,
  sourcecredDirectory,
  githubToken,
  loadWeights,
} from "./common";

describe("cli/common", () => {
  const exampleGithubToken = validateToken("0".repeat(40));
  beforeEach(() => {
    jest
      .spyOn(require("os"), "tmpdir")
      .mockReturnValue(path.join("/", "your", "tmpdir"));
  });

  describe("defaultPlugins", () => {
    it("is an array including the GitHub plugin name", () => {
      expect(defaultPlugins).toEqual(expect.arrayContaining(["github"]));
    });
  });

  describe("defaultSourcecredDirectory", () => {
    it("gives a file under the OS's temporary directory", () => {
      expect(defaultSourcecredDirectory()).toEqual(
        path.join("/", "your", "tmpdir", "sourcecred")
      );
    });
  });

  describe("sourcecredDirectory", () => {
    it("uses the environment variable when available", () => {
      const dir = path.join("/", "my", "sourcecred");
      process.env.SOURCECRED_DIRECTORY = dir;
      expect(sourcecredDirectory()).toEqual(dir);
    });
    it("uses the default directory if no environment variable is set", () => {
      delete process.env.SOURCECRED_DIRECTORY;
      expect(sourcecredDirectory()).toEqual(
        path.join("/", "your", "tmpdir", "sourcecred")
      );
    });
  });

  describe("githubToken", () => {
    it("uses the environment variable when available", () => {
      process.env.SOURCECRED_GITHUB_TOKEN = exampleGithubToken;
      expect(githubToken()).toEqual(exampleGithubToken);
    });
    it("returns `null` if the environment variable is not set", () => {
      delete process.env.SOURCECRED_GITHUB_TOKEN;
      expect(githubToken()).toBe(null);
    });
  });

  describe("loadWeights", () => {
    function tmpWithContents(contents: mixed) {
      const name = tmp.tmpNameSync();
      fs.writeFileSync(name, JSON.stringify(contents));
      return name;
    }
    it("works in a simple success case", async () => {
      const weights = defaultWeights();
      // Make a modification, just to be sure we aren't always loading the
      // default weights.
      weights.nodeManualWeights.set(NodeAddress.empty, 3);
      const weightsJSON = weightsToJSON(weights);
      const file = tmpWithContents(weightsJSON);
      const weights_ = await loadWeights(file);
      expect(weights).toEqual(weights_);
    });
    it("rejects if the file is not a valid weights file", () => {
      const file = tmpWithContents(1234);
      expect.assertions(1);
      return loadWeights(file).catch((e) =>
        expect(e.message).toMatch("provided weights file is invalid:")
      );
    });
    it("rejects if the file does not exist", () => {
      const file = tmp.tmpNameSync();
      expect.assertions(1);
      return loadWeights(file).catch((e) =>
        expect(e.message).toMatch("Could not find the weights file")
      );
    });
  });
});
