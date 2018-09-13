// @flow

import * as R from "./relationalView";

export function description(e: R.Entity) {
  const withAuthors = (x: R.AuthoredEntity) => {
    const authors = Array.from(x.authors());
    if (authors.length === 0) {
      // ghost author - probably a deleted account
      return "";
    }
    return "by " + authors.map((x) => description(x)).join(" & ") + " ";
  };
  const handlers = {
    repo: (x) => `${x.owner()}/${x.name()}`,
    issue: (x) => `#${x.number()}: ${x.title()}`,
    pull: (x) => {
      const diff = `+${x.additions()}/\u2212${x.deletions()}`;
      return `#${x.number()} (${diff}): ${x.title()}`;
    },
    review: (x) => `review ${withAuthors(x)}of ${description(x.parent())}`,
    comment: (x) => `comment ${withAuthors(x)}on ${description(x.parent())}`,
    // The commit type is included for completeness's sake and to
    // satisfy the typechecker, but won't ever be seen in the frontend
    // because the commit has a Git plugin prefix and will therefore by
    // handled by the git plugin adapter
    commit: (x) => `commit ${x.address().hash}`,
    userlike: (x) => `@${x.login()}`,
  };
  return R.match(handlers, e);
}
