// @flow

import * as NullUtil from "../../util/null";
import type {RelationalView} from "./relationalView";
import type {Contribution} from "../../core/credequate/contribution";
import {OPERATOR_KEY_PREFIX} from "../../core/credequate/operator";
import {KEYS} from "./declaration";
import * as GithubNode from "./nodes";

export function* createContributions(
  repoId: string,
  view: RelationalView
): Iterable<Contribution> {
  for (const pull of view.pulls()) {
    const commitAddress = pull.mergedAs();
    if (commitAddress == null) continue; // Skip unmerged PRs
    const commit = NullUtil.get(view.commit(commitAddress));

    const participants = new Map();
    const authorLoginSet = new Set();
    for (const author of pull.authors()) {
      authorLoginSet.add(author.login);
      const address = GithubNode.toRaw(author.address());
      const participant = participants.get(address);
      if (participant)
        participant.shares.push({key: KEYS.PULL_AUTHOR, subkey: repoId});
      else
        participants.set(address, {
          id: address,
          shares: [{key: KEYS.PULL_AUTHOR, subkey: repoId}],
        });
    }
    for (const author of commit.authors()) {
      const address = GithubNode.toRaw(author.address());
      const participant = participants.get(address);
      if (participant)
        participant.shares.push({key: KEYS.COMMIT_AUTHOR, subkey: repoId});
      else
        participants.set(address, {
          id: address,
          shares: [{key: KEYS.COMMIT_AUTHOR, subkey: repoId}],
        });
    }

    yield {
      id: pull.number(),
      plugin: "sourcecred/github",
      type: "Pull Request",
      timestampMs: commit.timestampMs(),
      participants: Array.from(participants.values()),
      expression: {
        description: "pull request",
        operator: "ADD",
        expressionOperands: [
          {
            description: "reactions",
            operator: OPERATOR_KEY_PREFIX + KEYS.REACTIONS_OPERATOR,
            expressionOperands: [],
            weightOperands: pull
              .reactions()
              .filter((reaction) => !authorLoginSet.has(reaction.user.login))
              .map((reaction) => ({
                key: KEYS.REACTION,
                subkey: reaction.content,
              })),
          },
        ],
        weightOperands: [{key: KEYS.PULL, subkey: repoId}],
      },
    };

    for (const review of pull.reviews()) {
      const reviewers = new Map();
      const authorLoginSet = new Set();
      for (const author of review.authors()) {
        authorLoginSet.add(author.login);
        const address = GithubNode.toRaw(author.address());
        const reviewer = reviewers.get(address);
        if (reviewer)
          reviewer.shares.push({key: KEYS.REVIEW_AUTHOR, subkey: repoId});
        else
          reviewers.set(address, {
            id: address,
            shares: [{key: KEYS.PULL_AUTHOR, subkey: repoId}],
          });
      }

      yield {
        id: review.address().id,
        plugin: "sourcecred/github",
        type: "Review",
        timestampMs: review.timestampMs(),
        participants: Array.from(reviewers.values()),
        expression: {
          description: "review",
          operator: "ADD",
          expressionOperands: [
            {
              description: "reactions",
              operator: OPERATOR_KEY_PREFIX + KEYS.REACTIONS_OPERATOR,
              expressionOperands: [],
              weightOperands: Array.from(review.comments())
                .flatMap((c) => c.reactions())
                .filter((reaction) => !authorLoginSet.has(reaction.user.login))
                .map((reaction) => ({
                  key: KEYS.REACTION,
                  subkey: reaction.content,
                })),
            },
          ],
          weightOperands: [{key: KEYS.REVIEW, subkey: repoId}],
        },
      };
    }
  }
}
