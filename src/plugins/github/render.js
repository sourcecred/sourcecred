// @flow

import React, {type Node as ReactNode} from "react";
import * as R from "./relationalView";

import Link from "../../webutil/Link";

function EntityUrl(props) {
  return (
    <Link href={props.entity.url()} target="_blank" rel="nofollow noopener">
      {props.children}
    </Link>
  );
}

function repo(x: R.Repo) {
  return (
    <EntityUrl entity={x}>
      {x.owner()}/{x.name()}
    </EntityUrl>
  );
}

function hyperlinkedNumber(x: R.Issue | R.Pull) {
  return <EntityUrl entity={x}>#{x.number()}</EntityUrl>;
}

function issue(x: R.Issue) {
  return (
    <span>
      {hyperlinkedNumber(x)}: {x.title()}
    </span>
  );
}

function pull(x: R.Pull) {
  const additions = <span style={{color: "green"}}>+{x.additions()}</span>;
  const deletions = <span style={{color: "red"}}>−{x.deletions()}</span>;
  const diff = (
    <span>
      ({additions}/{deletions})
    </span>
  );
  return (
    <span>
      {hyperlinkedNumber(x)} {diff}: {x.title()}
    </span>
  );
}

function review(x: R.Review) {
  const leader = <EntityUrl entity={x}>review</EntityUrl>;
  return (
    <span>
      {leader} on {description(x.parent())}
    </span>
  );
}

function comment(x: R.Comment) {
  const leader = <EntityUrl entity={x}>comment</EntityUrl>;
  return (
    <span>
      {leader} on {description(x.parent())}
    </span>
  );
}

function userlike(x: R.Userlike) {
  return <EntityUrl entity={x}>@{x.login()}</EntityUrl>;
}

function commit(x: R.Commit) {
  const shortHash = x.hash().slice(0, 7);
  return (
    <span>
      <EntityUrl entity={x}>{shortHash}</EntityUrl>
    </span>
  );
}

export function description(e: R.Entity): ReactNode {
  const handlers = {
    repo,
    issue,
    pull,
    review,
    comment,
    commit,
    userlike,
  };
  return R.match(handlers, e);
}
