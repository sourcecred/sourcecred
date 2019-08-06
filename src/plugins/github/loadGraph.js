// @flow

import sortBy from "lodash.sortby";
import path from "path";
import fs from "fs-extra";
import {TaskReporter} from "../../util/taskReporter";
import {createGraph} from "./createGraph";
import {createWeights} from "./createWeights";
import fetchGithubRepo from "./fetchGithubRepo";
import {declaration as githubDeclaration} from "./declaration";
import {RelationalView} from "./relationalView";
import {type RepoId, repoIdToString} from "../../core/repoId";
import {Graph} from "../../core/graph";
import {type Weights, toJSON as weightsToJSON} from "../../analysis/weights";
import * as MapUtil from "../../util/map";
import * as N from "./nodes";

export type Options = {|
  +repoIds: $ReadOnlyArray<RepoId>,
  +token: string,
  +cacheDirectory: string,
|};

/**
 * Loads several GitHub repositories, combining them into a single graph.
 */
export async function loadGraph(
  options: Options,
  taskReporter: TaskReporter
): Promise<Graph> {
  // We intentionally fetch repositories sequentially rather than in
  // parallel, because GitHub asks that we not make concurrent
  // requests. From <https://archive.is/LlkQp#88%>:
  //
  // > Make requests for a single user or client ID serially. Do not make
  // > make requests for a single user or client ID concurrently.
  const repositories = [];
  for (const repoId of options.repoIds) {
    const taskId = `github/${repoIdToString(repoId)}`;
    taskReporter.start(taskId);
    repositories.push(
      await fetchGithubRepo(repoId, {
        token: options.token,
        cacheDirectory: options.cacheDirectory,
      })
    );
    taskReporter.finish(taskId);
  }
  const views = repositories.map((r) => {
    const rv = new RelationalView();
    rv.addRepository(r);
    return rv;
  });
  const weightsAndScores = views.map(createWeights);
  const nodeManualWeights = MapUtil.merge(
    weightsAndScores.map((x) => x.nodeManualWeights)
  );
  const urlToScore = MapUtil.merge(weightsAndScores.map((x) => x.urlToScore));
  const urlScorePairs = sortBy(urlToScore.entries(), (x) => -x[1]);
  const weights: Weights = {
    nodeManualWeights,
    nodeTypeWeights: new Map(),
    edgeTypeWeights: new Map(),
  };
  for (const nt of githubDeclaration.nodeTypes) {
    const w = nt.prefix === N.Prefix.pull ? 1 : 0;
    weights.nodeTypeWeights.set(nt.prefix, w);
  }
  const weightsJson = weightsToJSON(weights);
  const weightsFile = path.join(options.cacheDirectory, "loc_weights.json");
  await fs.writeFile(weightsFile, JSON.stringify(weightsJson));
  const urlScoresFile = path.join(options.cacheDirectory, "url_to_score.json");
  await fs.writeFile(urlScoresFile, JSON.stringify(urlScorePairs));
  return Graph.merge(views.map(createGraph));
}
