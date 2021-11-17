// @flow

import {computeNeo4jData, type Neo4jOutput} from "./analysisUtils/neo4j";
import {CredGraph} from "../../core/credrank/credGraph";
import {Ledger} from "../../core/ledger/ledger";
import {
  computeCredAccounts,
  type CredAccountData,
} from "../../core/ledger/credAccounts";

/** Input type for the analysis API */
export type AnalysisInput = {|
  +credGraph: CredGraph,
  +ledger: Ledger,
  +featureFlags: {|
    neo4j?: boolean,
  |},
|};

/** Output type for the analysis API */
export type AnalysisOutput = {|
  +accounts: CredAccountData,
  +neo4j?: Neo4jOutput,
|};

/**
  A primary SourceCred API that transforms the given inputs into useful data
  analysis structures.
 */
export async function analysis(input: AnalysisInput): Promise<AnalysisOutput> {
  const accounts = computeCredAccounts(input.ledger, input.credGraph);
  const neo4j = input.featureFlags.neo4j ? computeNeo4jData(input) : undefined;

  return {accounts, neo4j};
}
