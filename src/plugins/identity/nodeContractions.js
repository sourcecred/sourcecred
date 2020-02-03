// @flow

import {type NodeContraction} from "../../core/graph";
import {type Identity, identityNode, type IdentitySpec} from "./identity";
import {resolveAlias} from "./alias";

/**
 * Outputs the NodeContractions for identity transformation.
 *
 * This function takes a list of identities and (semi-optionally) a discourse
 * server url. The server url is required if any Discourse identities are
 * present.
 *
 * It returns the needed information for transforming the graph to have
 * consolidated identities. Specifically, it returns a list of contractions;
 * applying these contractions via `Graph.contractions` will produce a graph with
 * consolidated identity nodes.
 *
 * TODO(#638): Once we develop a robust system for plugin configuration, we'll
 * refactor this method so it no longer takes a Discourse server url as a
 * special argument.
 */
export function nodeContractions(spec: IdentitySpec): NodeContraction[] {
  function errorOnDuplicate(xs: $ReadOnlyArray<string>, kind: string) {
    const s = new Set();
    for (const x of xs) {
      if (s.has(x)) {
        throw new Error(`Duplicate ${kind}: ${x}`);
      }
      s.add(x);
    }
  }
  const {identities, discourseServerUrl} = spec;
  const usernames = identities.map((x) => x.username);
  errorOnDuplicate(usernames, "username");
  const aliases = [].concat(...identities.map((x) => x.aliases));
  errorOnDuplicate(aliases, "alias");
  return identities.map((i) => _contraction(i, discourseServerUrl));
}

/**
 * Produce the contraction for an individual identity (along with the
 * discourseUrl, if needed).
 *
 * Exported for testing purposes.
 */
export function _contraction(
  identity: Identity,
  discourseUrl: string | null
): NodeContraction {
  const replacement = identityNode(identity);
  const old = identity.aliases.map((a) => resolveAlias(a, discourseUrl));
  return {old, replacement};
}
