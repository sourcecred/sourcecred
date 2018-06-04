// @flow

/*
 * Methods for rendering and displaying GitHub nodes.
 */
import stringify from "json-stable-stringify";
import type {NodeReference} from "../../core/porcelain";
import type {NodePayload} from "./types";
import {
  GithubReference,
  AuthorReference,
  AuthorPorcelain,
  CommentReference,
  IssueReference,
  IssuePorcelain,
  PullRequestReference,
  PullRequestPorcelain,
  PullRequestReviewReference,
  PullRequestReviewCommentReference,
  RepositoryPorcelain,
} from "./porcelain";

/* Give a short description for the GitHub node at given address.
 * Useful for e.g. displaying a title.
 */
export function nodeDescription(ref: NodeReference<NodePayload>) {
  const porcelain = ref.get();
  if (porcelain == null) {
    return `[unknown ${ref.type()}]`;
  }
  const type = new GithubReference(ref).type();
  switch (type) {
    case "REPOSITORY": {
      const repo = new RepositoryPorcelain(porcelain);
      return `${repo.owner()}/${repo.name()}`;
    }
    case "ISSUE": {
      const issue = new IssuePorcelain(porcelain);
      return `#${issue.number()}: ${issue.title()}`;
    }
    case "PULL_REQUEST": {
      const pr = new PullRequestPorcelain(porcelain);
      const diff = `+${pr.additions()}/\u2212${pr.deletions()}`;
      return `#${pr.number()} (${diff}): ${pr.title()}`;
    }
    case "COMMENT": {
      const comment = new CommentReference(ref);
      const issue = comment.parent();
      return `comment by @${authors(comment)} on #${num(issue)}`;
    }
    case "PULL_REQUEST_REVIEW": {
      const review = new PullRequestReviewReference(ref);
      const pr = review.parent();
      return `review by @${authors(review)} on #${num(pr)}`;
    }
    case "PULL_REQUEST_REVIEW_COMMENT": {
      const comment = new PullRequestReviewCommentReference(ref);
      const pr = comment.parent().parent();
      return `review comment by @${authors(comment)} on #${num(pr)}`;
    }
    case "AUTHOR": {
      return `@${new AuthorPorcelain(porcelain).login()}`;
    }
    default: {
      // eslint-disable-next-line no-unused-expressions
      (type: empty);
      throw new Error(
        `Tried to write description for invalid type ${stringify(
          ref.address()
        )}`
      );
    }
  }
}

function num(x: IssueReference | PullRequestReference) {
  const np = x.get();
  return np == null ? "[unknown]" : np.number();
}

function authors(authorable: {+authors: () => AuthorReference[]}) {
  // TODO: modify to accomodate multi-authorship
  const authorRefs = authorable.authors();
  const firstAuthor = authorRefs[0].get();
  return firstAuthor != null ? firstAuthor.login() : "[unknown]";
}
