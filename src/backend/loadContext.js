//@flow

import {type Project} from "../core/project";
import {type Weights as WeightsT} from "../core/weights";
import {type WeightedGraph as WeightedGraphT} from "../core/weightedGraph";
import * as WeightedGraph from "../core/weightedGraph";
import {type TimelineCredParameters} from "../analysis/timeline/params";
import {type GithubToken} from "../plugins/github/token";
import {type CacheProvider} from "./cache";
import {TaskReporter} from "../util/taskReporter";
import {TimelineCred} from "../analysis/timeline/timelineCred";
import {type ComputeFunction as ComputeFunctionT} from "./computeFunction";
import {type PluginLoaders as PluginLoadersT} from "./pluginLoaders";
import * as ComputeFunction from "./computeFunction";
import * as PluginLoaders from "./pluginLoaders";
import {default as githubLoader} from "../plugins/github/loader";
import {default as identityLoader} from "../plugins/identity/loader";
import {default as discourseLoader} from "../plugins/discourse/loader";
import {default as initiativesLoader} from "../plugins/initiatives/loader";
import {type PluginDeclarations} from "../analysis/pluginDeclaration";

export type LoadResult = {|
  +pluginDeclarations: PluginDeclarations,
  +weightedGraph: WeightedGraphT,
  +cred: TimelineCred,
|};

export type LoadContextOptions = {|
  +cache: CacheProvider,
  +reporter: TaskReporter,
  +githubToken: ?GithubToken,
  +initiativesDirectory: ?string,
|};

type OptionalLoadArguments = {|
  +weightsOverrides?: WeightsT,
  +params?: $Shape<TimelineCredParameters>,
|};

/**
 * This class is responsible composing all the variables and concrete functions
 * of the loading process.
 *
 * Specifically it composes:
 * - The loading environment (through the constructor).
 * - Concrete functions of the loading process (internally).
 * - Parameters for a load (Project and TimelineCredParameters).
 *
 * You can think of LoadContext as an instance where the environment and
 * functions have been composed so it's ready to perform a load with.
 */
export class LoadContext {
  +_options: LoadContextOptions;

  constructor(opts: LoadContextOptions) {
    this._options = opts;
  }

  /**
   * Here we're exposing multiple "proxy functions".
   * They're just aliases of functions from another module. But by aliasing them
   * as private properties we allow test code to spyOn these per LoadContext
   * instance, and without needing to know details of the external modules.
   *
   * Of course this would break if the external module changes, but that would
   * also occur if we directly depended on them.
   */

  +_declarations = PluginLoaders.declarations;
  +_updateMirror = PluginLoaders.updateMirror;
  +_createPluginGraphs = PluginLoaders.createPluginGraphs;
  +_createReferenceDetector = PluginLoaders.createReferenceDetector;
  +_contractPluginGraphs = PluginLoaders.contractPluginGraphs;
  +_overrideWeights = WeightedGraph.overrideWeights;
  +_computeTask = ComputeFunction.computeTask;

  /**
   * The above proxy functions we're deferring to, accept interfaces so they
   * could easily be mocked. This class takes the role of composing the concrete
   * implementations though. So we're exposing them as aliases here, similar to
   * the functions. As we'll need to test if these have been correctly passed on.
   */

  +_compute: ComputeFunctionT = TimelineCred.compute;
  +_pluginLoaders: PluginLoadersT = {
    github: githubLoader,
    discourse: discourseLoader,
    identity: identityLoader,
    initiatives: initiativesLoader,
  };

  /**
   * Performs a load in this context.
   */
  async load(
    project: Project,
    {params, weightsOverrides}: OptionalLoadArguments
  ): Promise<LoadResult> {
    const cachedProject = await this._updateMirror(
      this._pluginLoaders,
      this._options,
      project
    );
    const referenceDetector = await this._createReferenceDetector(
      this._pluginLoaders,
      this._options,
      cachedProject
    );
    const pluginGraphs = await this._createPluginGraphs(
      this._pluginLoaders,
      this._options,
      cachedProject,
      referenceDetector
    );
    const contractedGraph = await this._contractPluginGraphs(
      this._pluginLoaders,
      pluginGraphs
    );
    let weightedGraph = contractedGraph;
    if (weightsOverrides) {
      weightedGraph = this._overrideWeights(contractedGraph, weightsOverrides);
    }
    const plugins = this._declarations(this._pluginLoaders, project);
    const cred = await this._computeTask(this._compute, this._options, {
      params,
      plugins,
      weightedGraph,
    });
    return {
      pluginDeclarations: plugins,
      weightedGraph,
      cred,
    };
  }
}
