// @flow

import * as R from "./relationalView";
export type MsSinceEpoch = number;

export function createdAt(e: R.Entity): MsSinceEpoch | null {
  const handlers = {
    repo: () => null,
    issue: (x) => x.createdAt(),
    pull: (x) => x.createdAt(),
    review: (x) => x.createdAt(),
    comment: (x) => x.createdAt(),
    commit: () => null,
    userlike: () => null,
  };
  return R.match(handlers, e);
}
