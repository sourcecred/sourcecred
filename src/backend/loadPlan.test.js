// @flow

import tmp from "tmp";
import {TestTaskReporter} from "../util/taskReporter";
import {validateToken} from "../plugins/github/token";
import {createProject} from "../core/project";
import {type LoadPlan, createPlan, executePlan} from "./loadPlan";

type JestMockFn = $Call<typeof jest.fn>;

const fakeGraph = ({is: "fake-graph"}: any);
const fakeCred = ({is: "fake-cred"}: any);

const mockLoadPlan = (): LoadPlan => {
  const mirror = jest.fn();
  const createGraph = jest.fn();
  const computeCred = jest.fn();
  createGraph.mockResolvedValue(fakeGraph);
  computeCred.mockResolvedValue(fakeCred);
  return {mirror, createGraph, computeCred};
};

describe("src/backend/loadPlan", () => {
  describe("createPlan", () => {
    it("should not throw errors", () => {
      const sourcecredDirectory = tmp.dirSync().name;
      const token = validateToken("0".repeat(40));
      const reporter = new TestTaskReporter();
      const plugins = [];
      const _: LoadPlan = createPlan(
        sourcecredDirectory,
        token,
        plugins,
        reporter
      );
    });
  });

  describe("executePlan", () => {
    const project = createProject({id: "testing-project"});
    const params = {alpha: 0.123};

    it("should call it's LoadPlan components in order", async () => {
      // Given
      const loadPlan = mockLoadPlan();

      // When
      const update = await executePlan(loadPlan, project, params);

      // Then
      expect(update).toEqual({graph: fakeGraph, cred: fakeCred});
      const {mirror, createGraph, computeCred} = loadPlan;
      expect(mirror).toBeCalledTimes(1);
      expect(mirror).toBeCalledWith(project);
      expect(createGraph).toBeCalledTimes(1);
      expect(createGraph).toBeCalledWith(project);
      expect(computeCred).toBeCalledTimes(1);
      expect(computeCred).toBeCalledWith(fakeGraph, params);
    });

    it("should call mirror first", async () => {
      // Given
      const loadPlan = mockLoadPlan();
      const {mirror, createGraph, computeCred} = loadPlan;
      (mirror: JestMockFn).mockRejectedValue(new Error("mirror"));

      // When
      const p = executePlan(loadPlan, project, params);

      // Then
      await expect(p).rejects.toThrow("mirror");
      expect(mirror).toBeCalledTimes(1);
      expect(createGraph).toBeCalledTimes(0);
      expect(computeCred).toBeCalledTimes(0);
    });

    it("should call createGraph second", async () => {
      // Given
      const loadPlan = mockLoadPlan();
      const {mirror, createGraph, computeCred} = loadPlan;
      (createGraph: JestMockFn).mockRejectedValue(new Error("createGraph"));

      // When
      const p = executePlan(loadPlan, project, params);

      // Then
      await expect(p).rejects.toThrow("createGraph");
      expect(mirror).toBeCalledTimes(1);
      expect(createGraph).toBeCalledTimes(1);
      expect(computeCred).toBeCalledTimes(0);
    });

    it("should call computeCred last", async () => {
      // Given
      const loadPlan = mockLoadPlan();
      const {mirror, createGraph, computeCred} = loadPlan;
      (computeCred: JestMockFn).mockRejectedValue(new Error("computeCred"));

      // When
      const p = executePlan(loadPlan, project, params);

      // Then
      await expect(p).rejects.toThrow("computeCred");
      expect(mirror).toBeCalledTimes(1);
      expect(createGraph).toBeCalledTimes(1);
      expect(computeCred).toBeCalledTimes(1);
    });
  });
});
