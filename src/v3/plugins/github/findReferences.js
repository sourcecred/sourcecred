// @flow

import * as N from "./nodes";
import * as E from "./entityStore";
import {parseReferences} from "./parseReferences";

export type GithubReference = {|
  src: N.TextContentAddress,
  dst: N.ReferentAddress,
|};

type TextContentEntry = E.Issue | E.Pull | E.Comment | E.Review;
export function* findReferences(
  entityStore: E.EntityStore
): Iterator<GithubReference> {
  function* allGithubEntities(): Iterator<E.Entity> {
    yield* entityStore.repos();
    yield* entityStore.issues();
    yield* entityStore.pulls();
    yield* entityStore.reviews();
    yield* entityStore.comments();
    yield* entityStore.userlikes();
  }

  // refToAddress maps a "referencing string" to the address that string refers to.
  // There are 3 kinds of valid referencing strings:
  // - A canonical URL pointing to a GitHub entity, e.g.
  //   https://github.com/sourcecred/sourcecred/pull/416
  // - A # followed by a number, such as #416
  // - An @ followed by a login name, such as @decentralion
  const refToAddress: Map<string, N.StructuredAddress> = new Map();
  for (const e of allGithubEntities()) {
    const a = e.address;
    refToAddress.set(e.url, a);
    switch (e.type) {
      case "USERLIKE":
        refToAddress.set(`@${e.address.login}`, a);
        break;
      case "ISSUE":
        refToAddress.set(`#${e.address.number}`, a);
        break;
      case "PULL":
        refToAddress.set(`#${e.address.number}`, a);
        break;
      case "REPO":
        break;
      case "COMMENT":
        break;
      case "REVIEW":
        break;
      default:
        // eslint-disable-next-line no-unused-expressions
        (e.type: empty);
        break;
    }
  }

  function* allTextContentEntries(): Iterator<TextContentEntry> {
    yield* entityStore.issues();
    yield* entityStore.pulls();
    yield* entityStore.reviews();
    yield* entityStore.comments();
  }

  for (const e of allTextContentEntries()) {
    for (const ref of parseReferences(e.body)) {
      const refAddress = refToAddress.get(ref);
      if (refAddress != null) {
        yield {src: e.address, dst: refAddress};
      }
    }
  }
}
