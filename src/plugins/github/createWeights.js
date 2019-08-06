// @flow

import * as NullUtil from "../../util/null";
import {Graph, type NodeAddressT} from "../../core/graph";
import * as GitNode from "../git/nodes";
import * as N from "./nodes";
import * as R from "./relationalView";
import {createEdge} from "./edges";
import {ReactionContent$Values as Reactions} from "./graphqlTypes";

export function createWeights(
  view: R.RelationalView
): {|
  +nodeManualWeights: Map<NodeAddressT, number>,
  +urlToScore: Map<string, number>,
|} {
  const urlToScore = new Map<string, number>();
  const nodeManualWeights = new Map<NodeAddressT, number>();
  for (const pull of view.pulls()) {
    const address = N.toRaw(pull.address());
    const score = scoreFor(pull);
    nodeManualWeights.set(address, score);
    urlToScore.set(pull.url(), score);
  }
  return {nodeManualWeights, urlToScore};
}

function scoreFor(p: R.Pull) {
  if (p.mergedAs() == null) {
    return 0;
  }
  return p.additions();
}
