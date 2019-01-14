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
  // The `description` property should be a human-readable string that makes
  // it clear to a user what each NodeType does
  +description: string,
|};
