// @flow

import * as R from "./relationalView";
import * as E from "./edges";

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
    userlike: (x) => `@${x.login()}`,
  };
  return R.match(handlers, e);
}

export function edgeVerb(
  e: E.StructuredAddress,
  direction: "FORWARD" | "BACKWARD"
) {
  const forward = direction === "FORWARD";
  switch (e.type) {
    case "AUTHORS":
      return forward ? "authors" : "is authored by";
    case "MERGED_AS":
      return forward ? "merges" : "is merged by";
    case "HAS_PARENT":
      return forward ? "has parent" : "has child";
    case "REFERENCES":
      return forward ? "references" : "is referenced by";
    default:
      throw new Error(`Unexpected type ${(e.type: empty)}`);
  }
}
