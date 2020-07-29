// @flow

import {type TimestampMs} from "../../util/timestamp";
import {type Uuid} from "../../util/uuid";

export type NodeTagId = Uuid;

export type NodeTag = {|
  id: NodeTagId,
  mint: number, // additive semantics
  name: string,
|};

export type NodeUuid = Uuid;

export type CreditorNode = {|
  +id: NodeUuid,
  +tags: $ReadOnlyArray<NodeTagId>,
  +title: string,
  +description: string,
  +graphTimestamp: TimestampMs,
  +createdAt: TimestampMs,
  +mint: number,
  +parent: NodeUuid | null,
|};

//TODO graph node mint value = sum of node and all applied tags
//TODO graph edge weight value = product of edge and all applied tags
