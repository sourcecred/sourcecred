// @flow
import {type TimestampMs} from "../../util/timestamp";
import {type NodeAddressT} from "../../core/graph";
import {type InitiativeWeight} from "./initiative";
import {type NodeWeight} from "../../core/weights";

/**
 * Stored inside a initiatives.json db file with other initiatives,
 * modified and populated by a frontend.
 * The `id` prop is used as the key inside the db file
 */
export type InitiativeEntry = {|
  +id: string, // GUID
  +title: string,
  +timestampMs: TimestampMs,
  +weight: InitiativeWeight,
  +completed: boolean,
  // user nodes
  +champions: $ReadOnlyArray<NodeAddressT>,
  +dependencies: $ReadOnlyArray<NodeAddressT>,
  // an activity node. Will be more difficult to specify this
  +references: $ReadOnlyArray<NodeAddressT>,
  +contributions: $ReadOnlyArray<ContributionJson>,
|};

/**
 * type declaration for the db.json file
 */
export type InitiativeStore = {|
  initiatives: InitiativeEntry[],
|};

// A type with convenient default values for users to manually enter.
// Is exact because it is controlled by a web frontend
export type ContributionJson = {|
  // GUID
  +key: string,
  // Title is required, as this is essential for attribution.
  +title: string,
  // Defaults to an empty array.
  +contributors: $ReadOnlyArray<NodeAddressT>,
  // Timestamp of this node, but in ISO format as it's more human friendly.
  +timestampMs: TimestampMs,
  // Defaults to null.
  +weight: NodeWeight,
|};
