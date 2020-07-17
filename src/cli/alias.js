// @flow

import {type NodeAddressT, NodeAddress} from "../core/graph";
import {githubOwnerPattern} from "../plugins/github/repoId";
import {loginAddress as githubAddress} from "../plugins/github/nodes";
import {userNodeType as githubUserType} from "../plugins/github/declaration";
import {userAddress as discourseAddress} from "../plugins/discourse/address";
import {userNodeType as discourseUserType} from "../plugins/discourse/declaration";
import {userAddress as discordAddress} from "../plugins/experimental-discord/createGraph";
import {memberNodeType as discordUserType} from "../plugins/experimental-discord/declaration";

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
 *
 * Note: This system is deprecated. We do not intend to extend this to support other
 * plugins.
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
    case "discord": {
      return discordAddress(name);
    }
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
    default:
      throw new Error(`Unknown type for alias: ${alias}`);
  }
}

/**
 * Attempt to convert a NodeAddressT to an Alias.
 *
 * If the provided node address corresponds to a known aliasing scheme, an
 * alias will be returned. Otherwise, null is returned. Since it's possible
 * that the node address is a valid user node address provided by a plugin that
 * didn't update this alias registry, clients should endeavor to accomodate
 * those addresses rather than erroring.
 */
export function toAlias(n: NodeAddressT): Alias | null {
  const parts = NodeAddress.toParts(n);
  const terminator = parts[parts.length - 1];
  const prefixes: Map<string, NodeAddressT> = new Map([
    ["github", githubUserType.prefix],
    ["discourse", discourseUserType.prefix],
    ["discord", discordUserType.prefix],
  ]);

  for (const [prefix, nodePrefix] of prefixes.entries()) {
    if (NodeAddress.hasPrefix(n, nodePrefix)) {
      return `${prefix}/${terminator}`;
    }
  }
  return null;
}
