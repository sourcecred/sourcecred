// @flow
import {type TimestampMs} from "../../util/timestamp";
import {type NodeAddressT} from "../../core/graph";
import {type InitiativeWeight} from "./initiative";
import {type NodeEntryJson} from "./nodeEntry";

/**
 * Stored inside a initiatives.json db file with other initiatives.
 * presently the `id` prop is used as the key inside the db file
 */
export type InitiativeEntry = {|
  +id: string, // GUID
  +title: string,
  +timestampMs: TimestampMs,
  +weight: InitiativeWeight,
  +completed: boolean,
  // should be user nodes
  +champions: $ReadOnlyArray<NodeAddressT>,
  // other initiative nodes
  +dependencies: $ReadOnlyArray<NodeAddressT>,
  // an activity node. Will be more difficult to specify this
  +references: $ReadOnlyArray<NodeAddressT>,
  +contributions: $ReadOnlyArray<NodeEntryJson>,
|};

/**
 * type declaration for the db.json file
 */
export type InitiativeStore = {|
  initiatives: InitiativeEntry[],
|};
