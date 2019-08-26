// @flow

import {type Interval} from "./interval";
import {NodeAddress, type NodeAddressT} from "../../core/graph";
import {type FullTimelineCred} from "./distributionToCred";

export type FilteredTimelineCred = {|
  +intervals: $ReadOnlyArray<Interval>,
  +addressToCred: Map<NodeAddressT, $ReadOnlyArray<number>>,
|};

/**
 * Compress FullTimelineCred by discarding most nodes' cred.
 *
 * FullTimelineCred contains the cred at every interval for every node in the
 * graph. This could be tens of thousands of nodes and hundreds of intervals;
 * it's ungainly to store. To avoid this issue, we compress the cred down by
 * removing cred for most nodes. (We care a lot about users' cred; not so much
 * about the cred for every individual comment ever.)
 *
 * Right now, we do this by filtering out every node that doesn't match an
 * inclusion address prefix. In the future, we may have more sophisticated
 * logic, like keeping the top k nodes for each type.
 */
export function filterTimelineCred(
  fullCred: FullTimelineCred,
  nodeOrder: $ReadOnlyArray<NodeAddressT>,
  inclusionPrefixes: $ReadOnlyArray<NodeAddressT>
): FilteredTimelineCred {
  const intervals = fullCred.map((x) => x.interval);
  const addressToCred = new Map();
  function hasMatch(x: NodeAddressT): boolean {
    for (const prefix of inclusionPrefixes) {
      if (NodeAddress.hasPrefix(x, prefix)) {
        return true;
      }
    }
    return false;
  }
  for (let i = 0; i < nodeOrder.length; i++) {
    const addr = nodeOrder[i];
    if (hasMatch(addr)) {
      const addrCred = fullCred.map(({cred}) => cred[i]);
      addressToCred.set(addr, addrCred);
    }
  }
  return {intervals, addressToCred};
}
