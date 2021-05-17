// @flow

import path from "path";
import {SilentTaskReporter} from "../../util/taskReporter";
import {MappedReferenceDetector} from "../../core/references";
import {weightsForDeclaration} from "../../analysis/pluginDeclaration";
import {type InitiativesDirectory} from "./initiativesDirectory";
import {loadDirectory, createGraph} from "./loader";
import {declaration} from "./declaration";

describe("plugins/initiatives/loader", () => {
  describe("loadDirectory", () => {
    it("should report correct tasks", async () => {
      // Given
      const reporter = new SilentTaskReporter();
      const dir: InitiativesDirectory = {
        localPath: path.join(__dirname, "example"),
        remoteUrl: "http://example.com/initiatives",
      };

      // When
      const result = await loadDirectory(dir, reporter);

      // Then
      expect(result).toEqual({
        initiatives: {initiatives: expect.any(Function)},
        referenceDetector: expect.any(MappedReferenceDetector),
      });
      expect(reporter.activeTasks()).toEqual([]);
      expect(reporter.entries()).toEqual([
        {type: "START", taskId: "initiatives"},
        {type: "FINISH", taskId: "initiatives"},
      ]);
    });
  });

  describe("createGraph", () => {
    it("should add the default weights", async () => {
      // Given
      const mockRepository = {initiatives: () => []};
      const mockReferences = {addressFromUrl: () => null};

      // When
      const wg = await createGraph(mockRepository, mockReferences);

      // Then
      expect(wg.weights).toEqual(weightsForDeclaration(declaration));
    });
  });
});
