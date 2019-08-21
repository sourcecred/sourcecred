// @flow

import path from "path";

import {
  defaultPlugins,
  defaultSourcecredDirectory,
  sourcecredDirectory,
  githubToken,
  discourseKey,
} from "./common";

describe("cli/common", () => {
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
      process.env.SOURCECRED_GITHUB_TOKEN = "010101";
      expect(githubToken()).toEqual("010101");
    });
    it("returns `null` if the environment variable is not set", () => {
      delete process.env.SOURCECRED_GITHUB_TOKEN;
      expect(githubToken()).toBe(null);
    });
  });

  describe("discourseKey", () => {
    it("uses the environment variable when available", () => {
      process.env.SOURCECRED_DISCOURSE_KEY = "010101";
      expect(discourseKey()).toEqual("010101");
    });
    it("returns `null` if the environment variable is not set", () => {
      delete process.env.SOURCECRED_DISCOURSE_KEY;
      expect(discourseKey()).toBe(null);
    });
  });
});
