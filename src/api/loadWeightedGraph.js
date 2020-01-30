// @flow

import * as WeightedGraph from "../core/weightedGraph";
import {type WeightedGraph as WeightedGraphT} from "../core/weightedGraph";
import {type Weights as WeightsT} from "../core/weights";
import {type NodeContraction} from "../core/graph";
import {TaskReporter} from "../util/taskReporter";
import {type IdentitySpec} from "../plugins/identity/identity";
import {contractWeightedGraph} from "../plugins/identity/contractIdentities";
import {nodeContractions} from "../plugins/identity/nodeContractions";
import * as Discourse from "../plugins/discourse/loadWeightedGraph";
import * as Github from "../plugins/github/loadWeightedGraph";

export type LoadWeightedGraphOptions = {|
  +discourseOptions: ?Discourse.Options,
  +githubOptions: ?Github.Options,
  +identitySpec: IdentitySpec,
  +weightsOverrides: WeightsT,
|};

export async function loadWeightedGraph(
  options: LoadWeightedGraphOptions,
  taskReporter: TaskReporter
): Promise<WeightedGraphT> {
  taskReporter.start("load-weighted-graph");
  const {
    discourseOptions,
    githubOptions,
    identitySpec,
    weightsOverrides,
  } = options;
  const pluginGraphs = await _loadPluginGraphs(
    discourseOptions,
    githubOptions,
    taskReporter
  );
  const contractions = nodeContractions(identitySpec);
  const result = _combineGraphs(pluginGraphs, contractions, weightsOverrides);
  taskReporter.finish("load-weighted-graph");
  return result;
}

export function _loadPluginGraphs(
  discourseOptions: ?Discourse.Options,
  githubOptions: ?Github.Options,
  taskReporter: TaskReporter
): Promise<$ReadOnlyArray<WeightedGraphT>> {
  const promises: Promise<WeightedGraphT>[] = [];
  if (discourseOptions) {
    const promise = Discourse.loadWeightedGraph(discourseOptions, taskReporter);
    promises.push(promise);
  }
  if (githubOptions) {
    const promise = Github.loadWeightedGraph(githubOptions, taskReporter);
    promises.push(promise);
  }
  // It's important to use Promise.all so that we can load the plugins in
  // parallel -- since loading is often IO-bound, this can be a big performance
  // improvement.
  return Promise.all(promises);
}

export function _combineGraphs(
  graphs: $ReadOnlyArray<WeightedGraphT>,
  contractions: $ReadOnlyArray<NodeContraction>,
  weightsOverrides: WeightsT
): WeightedGraphT {
  const merged = WeightedGraph.merge(graphs);
  const contracted = contractWeightedGraph(merged, contractions);
  return WeightedGraph.overrideWeights(contracted, weightsOverrides);
}
