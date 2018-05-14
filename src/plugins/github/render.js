// @flow

/*
 * Methods for rendering and displaying GitHub nodes.
 */
import stringify from "json-stable-stringify";
import {Graph} from "@/core/graph";
import type {Address} from "@/core/address";
import {
  asEntity,
  Issue,
  PullRequest,
  Comment,
  PullRequestReview,
  PullRequestReviewComment,
  Author,
  Repository,
} from "./porcelain";

/* Give a short description for the GitHub node at given address.
 * Useful for e.g. displaying a title.
 */
export function nodeDescription(graph: Graph<any, any>, addr: Address) {
  const entity = asEntity(graph, addr);
  const type = entity.type();
  switch (type) {
    case "REPOSITORY": {
      const repo = Repository.from(entity);
      return `${repo.owner()}/${repo.name()}`;
    }
    case "ISSUE": {
      const issue = Issue.from(entity);
      return `#${issue.number()}: ${issue.title()}`;
    }
    case "PULL_REQUEST": {
      const pr = PullRequest.from(entity);
      return `#${pr.number()}: ${pr.title()}`;
    }
    case "COMMENT": {
      const comment = Comment.from(entity);
      const author = comment.authors()[0];
      return `comment by @${author.login()} on #${comment.parent().number()}`;
    }
    case "PULL_REQUEST_REVIEW": {
      const review = PullRequestReview.from(entity);
      const author = review.authors()[0];
      return `review by @${author.login()} on #${review.parent().number()}`;
    }
    case "PULL_REQUEST_REVIEW_COMMENT": {
      const comment = PullRequestReviewComment.from(entity);
      const author = comment.authors()[0];
      const pr = comment.parent().parent();
      return `review comment by @${author.login()} on #${pr.number()}`;
    }
    case "AUTHOR": {
      const author = Author.from(entity);
      return `@${author.login()}`;
    }
    default: {
      // eslint-disable-next-line no-unused-expressions
      (type: empty);
      throw new Error(
        `Tried to write description for invalid type ${stringify(addr)}`
      );
    }
  }
}
