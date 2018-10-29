// @flow

import {type NodeAddressT, type EdgeAddressT} from "../core/graph";

export type EdgeType = {|
  +forwardName: string,
  +backwardName: string,
  +defaultForwardWeight: number,
  +defaultBackwardWeight: number,
  +prefix: EdgeAddressT,
|};

export type NodeType = {|
  +name: string,
  +pluralName: string,
  +prefix: NodeAddressT,
  +defaultWeight: number,
|};
