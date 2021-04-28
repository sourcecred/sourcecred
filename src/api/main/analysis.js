// @flow

import {CredGraph} from "../../core/credrank/credGraph";
import {Ledger} from "../../core/ledger/ledger";
import {
  computeCredAccounts,
  type CredAccountData,
} from "../../core/ledger/credAccounts";

export type AnalysisInput = {|
  +credGraph: CredGraph,
  +ledger: Ledger,
|};

export type AnalysisOutput = {|
  +accounts: CredAccountData,
|};

/**
  A primary SourceCred API that transforms the given inputs into useful data
  analysis structures.
 */
export async function analysis(input: AnalysisInput): Promise<AnalysisOutput> {
  const accounts = computeCredAccounts(input.ledger, input.credGraph);

  return {accounts};
}
