// @flow

import type {NodeAddressT} from "../core/graph";

export type DescribedNode = {|
  +address: NodeAddressT,
  +type: string,
  +score: number,
  +description: string,
|};
