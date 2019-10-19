// @flow

export type URL = string;
import {type NodeAddressT} from "../../core/graph";

/**
 * This makes the assumption a Champion cannot fail in championing.
 * Instead of a success status, they should be removed if unsuccessful.
 *
 * There is also no timestamp for completion or each edge.
 * They will all use the initiative creation date instead.
 * We can support accurate edge timestamps by interpreting wiki histories.
 * However the additional complexity and requirements put on the tracker
 * don't seem worthwhile right now.
 * Especially because cred can flow even before bounties are released.
 * See https://discourse.sourcecred.io/t/write-the-initiatives-plugin/269/6
 * This will likely create dangling edges, as the initiative may be created
 * before some of it's contributions/references/dependencies exist as a node.
 */
export type Initiative = {|
  +title: string,
  +timestampMs: number,
  +completed: boolean,
  +tracker: NodeAddressT,
  +dependencies: $ReadOnlyArray<URL>,
  +references: $ReadOnlyArray<URL>,
  +contributions: $ReadOnlyArray<URL>,
  +champions: $ReadOnlyArray<URL>,
|};
