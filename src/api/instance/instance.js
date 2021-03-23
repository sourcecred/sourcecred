// @flow
import {type CredrankInput, type CredrankOutput} from "../main/credrank";
import {type GraphInput, type GraphOutput} from "../main/graph";
import {CredGraph} from "../../core/credrank/credGraph";
import {type WeightedGraph} from "../../core/weightedGraph";

/**
  Simple read interface for inputs and outputs of the main SourceCred API.
 */
export interface ReadOnlyInstance {
  /** Reads inputs required to run Graph. */
  readGraphInput(): Promise<GraphInput>;
  /** Reads inputs required to run CredRank. */
  readCredrankInput(): Promise<CredrankInput>;

  /** Reads a weighted graph generated by a previous run of Graph. */
  readWeightedGraphForPlugin(pluginId: string): Promise<WeightedGraph>;
  /** Reads a cred graph generated by a previous run of CredRank. */
  readCredGraph(): Promise<CredGraph>;
}

/**
  Simple read/write interface for inputs and outputs of the main SourceCred API.
 */
export interface Instance extends ReadOnlyInstance {
  /** Writes output after running Graph. */
  writeGraphOutput(graphOutput: GraphOutput): Promise<void>;
  /** Writes output after running CredRank. */
  writeCredrankOutput(credrankOutput: CredrankOutput): Promise<void>;
}
