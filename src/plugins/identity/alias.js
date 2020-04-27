// @flow

import {type NodeAddressT} from "../../core/graph";
import {githubOwnerPattern} from "../github/repoId";
import {loginAddress as githubAddress} from "../github/nodes";
import {userAddress as discourseAddress} from "../discourse/address";
import {
  identityAddress,
  USERNAME_PATTERN as _VALID_IDENTITY_PATTERN,
} from "./identity";

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

const _VALID_ALIAS = /^(\w+)[/](.*)$/;
const _VALID_GITHUB_NAME = new RegExp(`^@?(${githubOwnerPattern})$`);
const _VALID_DISCOURSE_NAME = /^@?([0-9a-z_-]+)$/i;

export function resolveAlias(
  alias: Alias,
  discourseUrl: string | null
): NodeAddressT {
  const match = alias.match(_VALID_ALIAS);
  if (match == null) {
    throw new Error(`Unable to parse alias: ${alias}`);
  }
  const [_, prefix, name] = match;
  switch (prefix) {
    case "github": {
      const match = name.match(_VALID_GITHUB_NAME);
      if (!match) {
        throw new Error(`Invalid GitHub username: ${name}`);
      }
      return githubAddress(match[1]);
    }
    case "discourse": {
      if (discourseUrl == null) {
        throw new Error(`Can't parse alias ${alias} without Discourse url`);
      }
      const match = name.match(_VALID_DISCOURSE_NAME);
      if (!match) {
        throw new Error(`Invalid Discourse username: ${name}`);
      }
      return discourseAddress(discourseUrl, match[1]);
    }
    case "sourcecred": {
      const match = name.match(_VALID_IDENTITY_PATTERN);
      if (!match) {
        throw new Error(`Invalid SourceCred identity: ${name}`);
      }
      return identityAddress(match[1]);
    }
    default:
      throw new Error(`Unknown type for alias: ${alias}`);
  }
}
