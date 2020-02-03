// @flow

import {type CacheProvider} from "./cache";
import {type Project, createProject} from "../core/project";
import * as Weights from "../core/weights";
import {validateToken} from "../plugins/github/token";
import {TestTaskReporter} from "../util/taskReporter";
import {LoadContext} from "./loadContext";

const fakeDeclarations = (["fake-declaration"]: any);
const fakePluginGraphs = ({is: "fake-plugin-graphs"}: any);
const fakeContractedGraph = ({is: "fake-contracted-graph"}: any);
const fakeWeightedGraph = ({is: "fake-weighted-graph"}: any);
const fakeCred = ({is: "fake-cred"}: any);

const mockCache = (): CacheProvider => ({
  database: jest.fn(),
});

const calledMoreThanOnce = (name: string) => () => {
  throw new Error(`Called ${name} more than once`);
};

const mockProxyMethods = (
  loadContext: LoadContext,
  project: Project,
  cache: CacheProvider
) => ({
  declarations: jest
    .spyOn(loadContext, "_declarations")
    .mockImplementation(calledMoreThanOnce("_declarations"))
    .mockReturnValueOnce(fakeDeclarations),
  updateMirror: jest
    .spyOn(loadContext, "_updateMirror")
    .mockImplementation(calledMoreThanOnce("_updateMirror"))
    .mockResolvedValueOnce({project, cache}),
  createPluginGraphs: jest
    .spyOn(loadContext, "_createPluginGraphs")
    .mockImplementation(calledMoreThanOnce("_createPluginGraphs"))
    .mockResolvedValueOnce(fakePluginGraphs),
  contractPluginGraphs: jest
    .spyOn(loadContext, "_contractPluginGraphs")
    .mockImplementation(calledMoreThanOnce("_contractPluginGraphs"))
    .mockReturnValueOnce(fakeContractedGraph),
  overrideWeights: jest
    .spyOn(loadContext, "_overrideWeights")
    .mockImplementation(calledMoreThanOnce("_overrideWeights"))
    .mockReturnValueOnce(fakeWeightedGraph),
  computeTask: jest
    .spyOn(loadContext, "_computeTask")
    .mockImplementation(calledMoreThanOnce("_computeTask"))
    .mockResolvedValueOnce(fakeCred),
});

describe("src/backend/loadContext", () => {
  describe("LoadContext", () => {
    const githubToken = validateToken("0".repeat(40));
    const project = createProject({id: "testing-project"});
    const params = {alpha: 0.123};

    describe("constructor", () => {
      /**
       * Note: we're not testing the proxy properties are the "correct" ones.
       * This would be too constraining. Instead we should use an integration
       * test to see if the results are as expected. However they should be
       * exposed, in order to validate they are correctly called during `load`.
       */
      it("should expose proxy properties", () => {
        // Given
        const cache = mockCache();
        const reporter = new TestTaskReporter();

        // When
        const loadContext = new LoadContext({cache, githubToken, reporter});

        // Then
        expect(loadContext).toMatchObject({
          // Properties
          _compute: expect.anything(),
          _pluginLoaders: expect.anything(),

          // Methods
          _declarations: expect.anything(),
          _updateMirror: expect.anything(),
          _createPluginGraphs: expect.anything(),
          _contractPluginGraphs: expect.anything(),
          _overrideWeights: expect.anything(),
          _computeTask: expect.anything(),
        });
      });
    });

    describe("load", () => {
      it("should call proxy methods with correct arguments", async () => {
        // Given
        const cache = mockCache();
        const reporter = new TestTaskReporter();
        const weightsOverrides = Weights.empty();
        const loadContext = new LoadContext({cache, githubToken, reporter});
        const spies = mockProxyMethods(loadContext, project, cache);

        // When
        await loadContext.load(project, {weightsOverrides, params});

        // Then
        const cachedProject = {project, cache};
        const expectedEnv = {
          githubToken,
          reporter,
          cache,
        };
        expect(spies.declarations).toBeCalledWith(
          loadContext._pluginLoaders,
          project
        );
        expect(spies.updateMirror).toBeCalledWith(
          loadContext._pluginLoaders,
          expectedEnv,
          project
        );
        expect(spies.createPluginGraphs).toBeCalledWith(
          loadContext._pluginLoaders,
          expectedEnv,
          cachedProject
        );
        expect(spies.contractPluginGraphs).toBeCalledWith(
          loadContext._pluginLoaders,
          fakePluginGraphs
        );
        expect(spies.overrideWeights).toBeCalledWith(
          fakeContractedGraph,
          weightsOverrides
        );
        expect(spies.computeTask).toBeCalledWith(
          loadContext._compute,
          expectedEnv,
          {weightedGraph: fakeWeightedGraph, plugins: fakeDeclarations, params}
        );
      });

      it("should support omitting optional arguments", async () => {
        // Given
        const cache = mockCache();
        const reporter = new TestTaskReporter();
        const loadContext = new LoadContext({cache, githubToken, reporter});
        const spies = mockProxyMethods(loadContext, project, cache);

        // When
        await loadContext.load(project, {});

        // Then
        const expectedEnv = {
          githubToken,
          reporter,
          cache,
        };

        // Omitting weight overrides option, should not call this function.
        expect(spies.overrideWeights).toBeCalledTimes(0);

        // We have a different input graph, because weight overrides wasn't called.
        // We're omitting the `params` argument from the options.
        expect(spies.computeTask).toBeCalledWith(
          loadContext._compute,
          expectedEnv,
          {weightedGraph: fakeContractedGraph, plugins: fakeDeclarations}
        );
      });

      it("should return a LoadResult", async () => {
        // Given
        const cache = mockCache();
        const reporter = new TestTaskReporter();
        const weightsOverrides = Weights.empty();
        const loadContext = new LoadContext({cache, githubToken, reporter});
        mockProxyMethods(loadContext, project, cache);

        // When
        const result = await loadContext.load(project, {
          weightsOverrides,
          params,
        });

        // Then
        expect(result).toEqual({
          pluginDeclarations: fakeDeclarations,
          weightedGraph: fakeWeightedGraph,
          cred: fakeCred,
        });
      });
    });
  });
});
