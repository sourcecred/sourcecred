// @flow

import {type URL} from "../../core/references";
import {type NodeWeight} from "../../core/weights/nodeWeights";
import {type NodeAddressT, NodeAddress} from "../../core/graph";
import {type TimestampMs, type TimestampISO} from "../../util/timestamp";
import * as Timestamp from "../../util/timestamp";
import {type InitiativeId} from "./initiative";
import {nodeEntryTypes} from "./declaration";

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
  // Defaults to an empty array.
  +contributors: $ReadOnlyArray<URL>,
  // Timestamp of this node, but in ISO format as it's more human friendly.
  +timestampIso: TimestampISO,
  // Defaults to null.
  +weight: NodeWeight | null,
}>;

export function addressForNodeEntry(
  field: NodeEntryField,
  id: InitiativeId,
  key: string
): NodeAddressT {
  return NodeAddress.append(nodeEntryTypes[field].prefix, ...id, key);
}

/**
 * Takes a NodeEntryJson and normalizes it to a NodeEntry.
 *
 * Will throw when required fields are missing. Otherwise handles default
 * values and converting ISO timestamps.
 */
export function normalizeNodeEntry(
  input: NodeEntryJson,
  defaultTimestampMs: TimestampMs
): NodeEntry {
  if (!input.title) {
    throw new TypeError(
      `Title is required for an entry, received ${JSON.stringify(input)}`
    );
  }

  return {
    key: input.key || _titleSlug(input.title),
    title: input.title,
    timestampMs: input.timestampIso
      ? Timestamp.fromISO(input.timestampIso)
      : defaultTimestampMs,
    contributors: input.contributors || [],
    weight: input.weight || null,
  };
}

/**
 * Creates a url-friendly-slug from the title of a NodeEntry. Useful for
 * generating a default key.
 *
 * Note: keys are not required to meet the formatting rules of this slug,
 * this is mostly for predictability and convenience of NodeAddresses.
 */
export function _titleSlug(title: string): string {
  return String(title)
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/--+/g, "-")
    .replace(/^-/, "")
    .replace(/-$/, "");
}
