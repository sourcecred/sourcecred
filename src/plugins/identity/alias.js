// @flow

import {type NodeAddressT} from "../../core/graph";
import {loginAddress as githubAddress} from "../github/nodes";
import {userAddress as discourseAddress} from "../discourse/address";

/** An Alias is a string specification of an identity within another plugin.
 *
 * For now, the supported alias forms are `github/${githubUsername}` and
 * `discourse/${discourseUsername}`. As a courtesty, if the user has put an @
 * before the username, we strip it for them.
 *
 * This format has been chosen to be moderately extensible and easy to maintain
 * by hand, as in the near future the alias files will be maintained by hand.
 * This system will not scale well when user-provided plugins need to add to the
 * aliasing scheme, so at that point we will rewrite this system.
 */
export type Alias = string;

export function resolveAlias(
  alias: Alias,
  discourseUrl: string | null
): NodeAddressT {
  const re = /(\w+)\/@?(\w+)/g;
  const match = re.exec(alias);
  if (match == null) {
    throw new Error(`Unable to parse alias: ${alias}`);
  }
  const prefix = match[1];
  const name = match[2];
  switch (prefix) {
    case "github": {
      return githubAddress(name);
    }
    case "discourse": {
      if (discourseUrl == null) {
        throw new Error(`Can't parse alias ${alias} without Discourse url`);
      }
      return discourseAddress(discourseUrl, name);
    }
    default:
      throw new Error(`Unknown type for alias: ${alias}`);
  }
}
