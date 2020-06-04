// @flow

import {type Weights} from "../core/weights";
import {type CredResult} from "./credResult";
import {type TimelineCredParameters} from "./timeline/params";
import {Graph} from "../core/graph";
import {type PluginDeclarations} from "./pluginDeclaration";

/**
 * The CredView is an interface for Graph-aware queries over a CredResult.
 *
 * For example, if you want to find out all of the flows of cred into or out of a node,
 * then you need to overlay Cred data on the structure of the Graph. This class makes
 * such queries convenient.
 */
export class CredView {
  _credResult: CredResult;

  constructor(result: CredResult) {
    this._credResult = result;
  }

  graph(): Graph {
    return this._credResult.weightedGraph.graph;
  }

  weights(): Weights {
    return this._credResult.weightedGraph.weights;
  }

  params(): TimelineCredParameters {
    return this._credResult.params;
  }

  plugins(): PluginDeclarations {
    return this._credResult.plugins;
  }

  credResult(): CredResult {
    return this._credResult;
  }
}
