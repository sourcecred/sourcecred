// @flow

import * as N from "./nodes";
import * as R from "./relationalView";
import {parseReferences} from "./parseReferences";

export type GithubReference = {|
  src: N.TextContentAddress,
  dst: N.ReferentAddress,
|};

type TextContentEntry =
  | R.IssueEntry
  | R.PullEntry
  | R.CommentEntry
  | R.ReviewEntry;
export function* findReferences(
  view: R.RelationalView
): Iterator<GithubReference> {
  function* allGithubEntities(): Iterator<R.Entry> {
    yield* view.repos();
    yield* view.issues();
    yield* view.pulls();
    yield* view.reviews();
    yield* view.comments();
    yield* view.userlikes();
  }

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
      default:
        break;
    }
  }

  function* allTextContentEntries(): Iterator<TextContentEntry> {
    yield* view.issues();
    yield* view.pulls();
    yield* view.reviews();
    yield* view.comments();
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
