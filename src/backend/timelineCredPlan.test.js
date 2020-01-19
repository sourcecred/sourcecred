// @flow

import {TestTaskReporter} from "../util/taskReporter";
import {timelineCredPlan} from "./timelineCredPlan";

const mockCompute = () => jest.fn();

const fakeGraph = ({
  toJSON: () => ({is: "fake-graph"}),
}: any);

const fakeCred = ({
  toJSON: () => ({is: "fake-cred"}),
}: any);

describe("src/backend/timelineCredPlan", () => {
  describe("timelineCredPlan", () => {
    it("should defer to the provided compute function", async () => {
      // Given
      const plugins = [];
      const reporter = new TestTaskReporter();
      const params = {alpha: 0.456};
      const compute = mockCompute();
      compute.mockResolvedValueOnce(fakeCred);

      // When
      const computeCred = timelineCredPlan(plugins, reporter, compute);
      const cred = await computeCred(fakeGraph, params);

      // Then
      expect(cred).toEqual(fakeCred);
      expect(compute).toBeCalledTimes(1);
      expect(compute).toBeCalledWith({
        graph: fakeGraph,
        params,
        plugins,
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
      const computeCred = timelineCredPlan(plugins, reporter, compute);
      await computeCred(fakeGraph, params);

      // Then
      expect(reporter.activeTasks()).toEqual([]);
      expect(reporter.entries()).toEqual([
        {type: "START", taskId: "compute-cred"},
        {type: "FINISH", taskId: "compute-cred"},
      ]);
    });
  });
});
