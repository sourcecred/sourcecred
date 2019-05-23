// @flow
/**
 * This module contains declarations for the AnalysisAdapter.
 *
 * In general, "Adapters" are general interfaces for plugins to provide
 * information about SourceCred graphs. Adapters are scoped to a particular
 * purpose. The AnalysisAdapter exists for the purpose of analyzing cred
 * in a project. As such, the AnalysisAdapter provides the cred graph,
 * a declaration of the types, and any other information needed to compute
 * PageRank scores.
 *
 * In general, every plugin will provide an AnalysisAdapter, and the analysis
 * data pipeline will aggregate results across all plugins' adapters.
 *
 * TODO(@decentralion): As the AnalysisAdapter evolves, consider whether it
 * would make sense to simply move the data the AnalysisAdapter provides
 * directly into the core Graph. Note that doing so would require considerable
 * changes to the Graph APIs, including having Node be a rich data type rather
 * than just an address, and allowing edges to Nodes which do not exist in the
 * graph. Due to the complexity, such a refactor should not be undertaken
 * lightly.
 */

import {Graph, type NodeAddressT} from "../core/graph";
import type {RepoId} from "../core/repoId";
import type {PluginDeclaration} from "./pluginDeclaration";

/**
 * Enables loading a plugin's AnalysisAdapter on the backend.
 *
 * Takes a RepoId and the path to the SourceCred directory, and provides an
 * AnalysisAdapter for that plugin. Also provides the declaration for the
 * plugin.
 */
export interface IBackendAdapterLoader {
  declaration(): PluginDeclaration;
  load(sourcecredDirectory: string, repoId: RepoId): Promise<IAnalysisAdapter>;
}

export type MsSinceEpoch = number;
/**
 * Provides data needed for cred analysis for an individual plugin.
 *
 * It's scoped to a particular RepoId (and plugin).
 */
export interface IAnalysisAdapter {
  declaration(): PluginDeclaration;
  graph(): Graph;
  /**
   * Provides a timestamp of when the node was created.
   *
   * The creation time is for the object the node represents, rather than the
   * time the node was added to the graph. E.g. a commit authored in 2001 has a
   * createdAt timestamp for a date in 2001.
   *
   * createdAt may be null if the node doesn't have a creation time available,
   * or is "timeless". A "timeless" node is one that we want to treat as
   * always existing for purposes of cred analysis. (E.g. we may want to
   * consider user identities timeless.)
   */
  createdAt(n: NodeAddressT): MsSinceEpoch | null;
}
