// @flow

import dedent from "../../util/dedent";
import {type NodeAddressT, NodeAddress} from "../../core/graph";
import {MappedReferenceDetector, type URL} from "../../core/references";
import {RelationalView} from "./relationalView";

/**
 * Builds a GithubReferenceDetector using multiple RelationalView.
 * As RelationalView should only be used for one repository at a time, you will
 * commonly want to compose several of them into one GithubReferenceDetector.
 *
 * Note: duplicates are normally expected. However for any URL, the corresponding
 * NodeAddressT should be the same, or we'll throw an error.
 */
export function fromRelationalViews(
  views: $ReadOnlyArray<RelationalView>
): GithubReferenceDetector {
  const map: Map<URL, NodeAddressT> = new Map();
  for (const view of views) {
    for (const [url, addr] of view.urlReferenceMap().entries()) {
      const existing = map.get(url);
      if (existing && existing !== addr) {
        throw new Error(dedent`\
          An entry for ${url} already existed, but with a different NodeAddressT.
          This is probably a bug with SourceCred. Please report it on GitHub.
          Old: ${NodeAddress.toString(existing)}
          New: ${NodeAddress.toString(addr)}
        `);
      }
      map.set(url, addr);
    }
  }
  return new GithubReferenceDetector(map);
}

export const GithubReferenceDetector = MappedReferenceDetector;
