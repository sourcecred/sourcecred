// @flow

import {type CacheProvider} from "./cache";
import {type Project, createProject} from "../core/project";
import * as Weights from "../core/weights";
import {validateToken} from "../plugins/github/token";
import {TestTaskReporter} from "../util/taskReporter";
import {LoadContext} from "./loadContext";

const fakes = {
  declarations: ({fake: "declarations"}: any),
  pluginGraphs: ({fake: "pluginGraphs"}: any),
  contractedGraph: ({fake: "contractedGraph"}: any),
  weightedGraph: ({fake: "weightedGraph"}: any),
  timelineCred: ({fake: "timelineCred"}: any),
  initiativesDirectory: ({fake: "initiativesDirectory"}: any),
};

const mockCacheProvider = (): CacheProvider => ({
  database: jest.fn(),
});

const spyBuilderFor = (target) => ({
  proxyMethod: (on: string) => {
    return jest.spyOn(target, `_${on}`).mockImplementation(() => {
      throw new Error(`Unexpected call of _${on}`);
    });
  },
});

const mockProxyMethods = (
  loadContext: LoadContext,
  project: Project,
  cache: CacheProvider
) => {
  const spyBuilder = spyBuilderFor(loadContext);

  return {
    declarations: spyBuilder
      .proxyMethod("declarations")
      .mockReturnValueOnce(fakes.declarations),

    updateMirror: spyBuilder
      .proxyMethod("updateMirror")
      .mockResolvedValueOnce({project, cache}),

    createPluginGraphs: spyBuilder
      .proxyMethod("createPluginGraphs")
      .mockResolvedValueOnce(fakes.pluginGraphs),

    contractPluginGraphs: spyBuilder
      .proxyMethod("contractPluginGraphs")
      .mockReturnValueOnce(fakes.contractedGraph),

    overrideWeights: spyBuilder
      .proxyMethod("overrideWeights")
      .mockReturnValueOnce(fakes.weightedGraph),

    computeTask: spyBuilder
      .proxyMethod("computeTask")
      .mockResolvedValueOnce(fakes.timelineCred),
  };
};

describe("src/backend/loadContext", () => {
  describe("LoadContext", () => {
    const githubToken = validateToken("0".repeat(40));
    const project = createProject({id: "testing-project"});
    const params = {alpha: 0.123};
    const initiativesDirectory = fakes.initiativesDirectory;

    describe("constructor", () => {
      /**
       * Note: we're not testing the proxy properties are the "correct" ones.
       * This would be too constraining. Instead we should use an integration
       * test to see if the results are as expected. However they should be
       * exposed, in order to validate they are correctly called during `load`.
       */
      it("should expose proxy properties", () => {
        // Given
        const cache = mockCacheProvider();
        const reporter = new TestTaskReporter();

        // When
        const loadContext = new LoadContext({
          cache,
          githubToken,
          reporter,
          initiativesDirectory,
        });

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
        const cache = mockCacheProvider();
        const reporter = new TestTaskReporter();
        const weightsOverrides = Weights.empty();
        const loadContext = new LoadContext({
          cache,
          githubToken,
          reporter,
          initiativesDirectory,
        });
        const spies = mockProxyMethods(loadContext, project, cache);

        // When
        await loadContext.load(project, {weightsOverrides, params});

        // Then
        const cachedProject = {project, cache};
        const expectedEnv = {
          initiativesDirectory,
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
          fakes.pluginGraphs
        );
        expect(spies.overrideWeights).toBeCalledWith(
          fakes.contractedGraph,
          weightsOverrides
        );
        expect(spies.computeTask).toBeCalledWith(
          loadContext._compute,
          expectedEnv,
          {
            weightedGraph: fakes.weightedGraph,
            plugins: fakes.declarations,
            params,
          }
        );
      });

      it("should support omitting optional arguments", async () => {
        // Given
        const cache = mockCacheProvider();
        const reporter = new TestTaskReporter();
        const loadContext = new LoadContext({
          cache,
          githubToken,
          reporter,
          initiativesDirectory,
        });
        const spies = mockProxyMethods(loadContext, project, cache);

        // When
        await loadContext.load(project, {});

        // Then
        const expectedEnv = {
          initiativesDirectory,
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
          {weightedGraph: fakes.contractedGraph, plugins: fakes.declarations}
        );
      });

      it("should return a LoadResult", async () => {
        // Given
        const cache = mockCacheProvider();
        const reporter = new TestTaskReporter();
        const weightsOverrides = Weights.empty();
        const loadContext = new LoadContext({
          cache,
          githubToken,
          reporter,
          initiativesDirectory,
        });
        mockProxyMethods(loadContext, project, cache);

        // When
        const result = await loadContext.load(project, {
          weightsOverrides,
          params,
        });

        // Then
        expect(result).toEqual({
          pluginDeclarations: fakes.declarations,
          weightedGraph: fakes.weightedGraph,
          cred: fakes.timelineCred,
        });
      });
    });
  });
});
