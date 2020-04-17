// @flow

import {type URL} from "../../core/references";
import {type NodeWeight} from "../../core/weights";
import {type TimestampMs, type TimestampISO} from "../../util/timestamp";

/**
 * Represents an "inline contribution" node. They're called entries and named
 * by type: contribution entry, reference entry, dependency entry.
 * The generalization of this is a node entry.
 */

// Which field the NodeEntry appeared in.
export type NodeEntryField = "DEPENDENCY" | "REFERENCE" | "CONTRIBUTION";

// A normalized NodeEntry type, guaranteed to have all relevant fields set.
export type NodeEntry = {|
  // A single line description of what this contribution represents.
  +title: string,
  // A unique key to use as a suffix to the NodeAddress.
  // The InitiativeFile and NodeEntryField will be prefixes, so it must be
  // unique within one field's array of entries.
  +key: string,
  // URLs pointing to the contributors. Similar to the initiatives will use
  // reference detection to create edges.
  +contributors: $ReadOnlyArray<URL>,
  // Timestamp for this node.
  +timestampMs: TimestampMs,
  // NodeWeight for this node.
  +weight: NodeWeight | null,
|};

// A type with convenient default values for users to manually enter.
// Should be inexact Flow type as with JSON sources you never know.
export type NodeEntryJson = $Shape<{
  // Title is required, as this is essential for attribution.
  +title: string,
  // Key defaults to a url-friendly-slug of the title. Override it if you need
  // to preserve a specific NodeAddress, or the slug produces duplicate keys.
  +key: string,
  +contributors: $ReadOnlyArray<URL>,
  // Timestamp of this node, but in ISO format as it's more human friendly.
  +timestampIso: TimestampISO,
  +weight: NodeWeight | null,
}>;
