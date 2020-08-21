// @flow

import {type NodeAddressT} from "../core/graph";
import {CredView} from "../analysis/credView";

/**
 * This module contains experimental data analysis methods.
 * Please dont assume these are going to be supported long-term.
 * They're also untested.
 * Have fun! :)
 */

// A summary of cred creation and minting by nodes matching a certain prefix.
export type Summary = {
  +name: string,
  +prefix: NodeAddressT,
  +totalCred: number,
  +credByInterval: $ReadOnlyArray<number>,
  +totalMint: number,
  +mintByInterval: $ReadOnlyArray<number>,
};

// type specifiying a summary to be created.
export type SummarySpec = {|
  +name: string,
  +prefix: NodeAddressT,
|};

export function computeSummary(spec: SummarySpec, view: CredView): Summary {
  const intervals = view.intervalEnds();
  let totalCred = 0;
  let totalMint = 0;
  const credByInterval: number[] = new Array(intervals.length).fill(0);
  const mintByInterval: number[] = new Array(intervals.length).fill(0);
  view
    .nodes({prefix: spec.prefix})
    .filter((n) => n.credOverTime == null)
    .forEach((n) => {
      totalMint += n.minted;
      totalCred += n.credSummary.cred;
      const {intervalIndex} = n;
      if (intervalIndex != null) {
        credByInterval[intervalIndex] += n.credSummary.cred;
        mintByInterval[intervalIndex] += n.minted;
      }
    });
  return {
    name: spec.name,
    prefix: spec.prefix,
    totalCred,
    credByInterval,
    totalMint,
    mintByInterval,
  };
}

export type PluginSummary = Summary & {+types: $ReadOnlyArray<Summary>};

export function pluginSummaries(v: CredView): $ReadOnlyArray<PluginSummary> {
  return v.plugins().map((p) => {
    const summary = computeSummary({name: p.name, prefix: p.nodePrefix}, v);
    const typeSpecs = p.nodeTypes.map((t) => ({
      name: t.name,
      prefix: t.prefix,
    }));
    const typeSummaries: Summary[] = typeSpecs.map((s) => computeSummary(s, v));
    return {...summary, types: typeSummaries};
  });
}
