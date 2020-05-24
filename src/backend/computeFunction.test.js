import {TestTaskReporter} from "../util/taskReporter";
import {TimelineCred} from "../analysis/timeline/timelineCred";
import {type ComputeFunction, computeTask} from "./computeFunction";

const mockCompute = () => jest.fn();

const fakeWeightedGraph = ({is: "fake-weighted-graph"}: any);
const fakeCred = ({
  toJSON: () => ({is: "fake-cred"}),
}: any);

describe("src/backend/computeFunction", () => {
  describe("ComputeFunction", () => {
    it("should match the TimelineCred.compute signature", () => {
      const _: ComputeFunction = TimelineCred.compute;
    });
  });

  describe("computeTask", () => {
    it("should defer to the provided compute function", async () => {
      // Given
      const plugins = [];
      const reporter = new TestTaskReporter();
      const params = {alpha: 0.456};
      const compute = mockCompute();
      compute.mockResolvedValueOnce(fakeCred);

      // When
      const cred = await computeTask(
        compute,
        {reporter},
        {weightedGraph: fakeWeightedGraph, plugins, params}
      );

      // Then
      expect(cred).toEqual(fakeCred);
      expect(compute).toBeCalledTimes(1);
      expect(compute).toBeCalledWith({
        weightedGraph: fakeWeightedGraph,
        plugins,
        params,
      });
    });

    it("should give the right tasks to the TaskReporter", async () => {
      // Given
      const plugins = [];
      const reporter = new TestTaskReporter();
      const params = {alpha: 0.456};
      const compute = mockCompute();
      compute.mockResolvedValueOnce(fakeCred);

      // When
      await computeTask(
        compute,
        {reporter},
        {weightedGraph: fakeWeightedGraph, plugins, params}
      );

      // Then
      expect(reporter.activeTasks()).toEqual([]);
      expect(reporter.entries()).toEqual([
        {type: "START", taskId: "compute-cred"},
        {type: "FINISH", taskId: "compute-cred"},
      ]);
    });
  });
});
