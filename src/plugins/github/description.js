// @flow

import * as R from "./relationalView";

function repo(x: R.Repo) {
  return `[${x.owner()}/${x.name()}](${x.url()})`;
}

function issueOrPull(x: R.Issue | R.Pull) {
  return `[#${x.number()}](${x.url()}): ${x.title()}`;
}

function review(x: R.Review) {
  return `[review](${x.url()}) on ${description(x.parent())}`;
}

function comment(x: R.Comment) {
  return `[comment](${x.url()}) on ${description(x.parent())}`;
}

function userlike(x: R.Userlike) {
  return `[@${x.login()}](${x.url()})`;
}

// The commit type is included for completeness's sake and to
// satisfy the typechecker, but won't ever be seen in the frontend
// because the commit has a Git plugin prefix and will therefore by
// handled by the git plugin adapter
function commit(x: R.Commit) {
  const shortHash = x.address().hash.slice(0, 7);
  return `[${shortHash}](${x.url()})`;
}

export function description(e: R.Entity): string {
  const handlers = {
    repo,
    issue: issueOrPull,
    pull: issueOrPull,
    review,
    comment,
    commit,
    userlike,
  };
  return R.match(handlers, e);
}
