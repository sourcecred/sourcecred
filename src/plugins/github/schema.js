// @flow

import * as Schema from "../../graphql/schema";

export default function schema(): Schema.Schema {
  const s = Schema;
  const types = {
    DateTime: s.scalar("string"),
    GitObjectID: s.scalar("string"),
    GitTimestamp: s.scalar("string"),
    Int: s.scalar("number"),
    String: s.scalar("string"),
    URI: s.scalar("string"),
    PullRequestReviewState: s.enum([
      "PENDING",
      "COMMENTED",
      "APPROVED",
      "CHANGES_REQUESTED",
      "DISMISSED",
    ]),
    ReactionContent: s.enum([
      "THUMBS_UP",
      "THUMBS_DOWN",
      "LAUGH",
      "HOORAY",
      "CONFUSED",
      "HEART",
      "ROCKET",
      "EYES",
    ]),
    Repository: s.object({
      id: s.id(),
      url: s.primitive(s.nonNull("URI")),
      name: s.primitive(s.nonNull("String")),
      owner: s.node("RepositoryOwner"),
      issues: s.connection("Issue"),
      pullRequests: s.connection("PullRequest"),
      defaultBranchRef: s.node("Ref"),
      createdAt: s.primitive(s.nonNull("DateTime")),
    }),
    Issue: s.object({
      id: s.id(),
      url: s.primitive(s.nonNull("URI")),
      title: s.primitive(s.nonNull("String")),
      body: s.primitive(s.nonNull("String")),
      number: s.primitive(s.nonNull("Int")),
      author: s.node("Actor"),
      comments: s.connection("IssueComment"),
      reactions: s.connection("Reaction"),
      createdAt: s.primitive(s.nonNull("DateTime")),
    }),
    PullRequest: s.object({
      id: s.id(),
      url: s.primitive(s.nonNull("URI")),
      title: s.primitive(s.nonNull("String")),
      body: s.primitive(s.nonNull("String")),
      number: s.primitive(s.nonNull("Int")),
      mergeCommit: s.node("Commit"),
      additions: s.primitive(s.nonNull("Int")),
      deletions: s.primitive(s.nonNull("Int")),
      author: s.node("Actor"),
      comments: s.connection("IssueComment"), // yes, PRs have IssueComments
      reviews: s.connection("PullRequestReview"),
      reactions: s.connection("Reaction"),
      createdAt: s.primitive(s.nonNull("DateTime")),
      baseRefName: s.primitive(s.nonNull("String")),
    }),
    IssueComment: s.object({
      id: s.id(),
      url: s.primitive(s.nonNull("URI")),
      body: s.primitive(s.nonNull("String")),
      author: s.node("Actor"),
      reactions: s.connection("Reaction"),
      createdAt: s.primitive(s.nonNull("DateTime")),
    }),
    PullRequestReview: s.object({
      id: s.id(),
      url: s.primitive(s.nonNull("URI")),
      body: s.primitive(s.nonNull("String")),
      author: s.node("Actor"),
      state: s.primitive(s.nonNull("PullRequestReviewState")),
      comments: s.connection("PullRequestReviewComment"),
      createdAt: s.primitive(s.nonNull("DateTime")),
    }),
    PullRequestReviewComment: s.object({
      id: s.id(),
      url: s.primitive(s.nonNull("URI")),
      body: s.primitive(s.nonNull("String")),
      author: s.node("Actor"),
      reactions: s.connection("Reaction"),
      createdAt: s.primitive(s.nonNull("DateTime")),
    }),
    Reaction: s.object({
      id: s.id(),
      content: s.primitive(s.nonNull("ReactionContent")),
      user: s.node("User", s.unfaithful(["User", "Organization"])),
      createdAt: s.primitive(s.nonNull("DateTime")),
    }),
    Ref: s.object({
      id: s.id(),
      // Unlike most node references, this is guaranteed non-null (but
      // we have no way to express that).
      target: s.node("GitObject"),
    }),
    GitObject: s.union(["Blob", "Commit", "Tag", "Tree"]),
    Blob: s.object({
      id: s.id(),
      oid: s.primitive(s.nonNull("GitObjectID")),
    }),
    Commit: s.object({
      id: s.id(),
      url: s.primitive(s.nonNull("URI")),
      oid: s.primitive(s.nonNull("GitObjectID")),
      message: s.primitive(s.nonNull("String")),
      author: /* GitActor */ s.nested({
        // The GitHub schema indicates that `date` can be null, but does
        // not indicate when this might be the case.
        date: s.primitive(s.nullable("GitTimestamp")),
        user: s.node("User", s.unfaithful(["User", "Bot"])),
      }),
      parents: s.connection("Commit"),
      // In contrast to the author.date, this is both nonNull and is
      // specifically the authoredDate. Docs for author.date suggest that
      // field might be the commiter date instead.
      authoredDate: s.primitive(s.nonNull("GitTimestamp")),
    }),
    Tag: s.object({
      id: s.id(),
      oid: s.primitive(s.nonNull("GitObjectID")),
    }),
    Tree: s.object({
      id: s.id(),
      oid: s.primitive(s.nonNull("GitObjectID")),
    }),
    Actor: s.union(["User", "Bot", "Organization"]), // actually an interface
    RepositoryOwner: s.union(["User", "Organization"]), // actually an interface
    User: s.object({
      id: s.id(),
      url: s.primitive(s.nonNull("URI")),
      login: s.primitive(s.nonNull("String")),
    }),
    Bot: s.object({
      id: s.id(),
      url: s.primitive(s.nonNull("URI")),
      login: s.primitive(s.nonNull("String")),
    }),
    Organization: s.object({
      id: s.id(),
      url: s.primitive(s.nonNull("URI")),
      login: s.primitive(s.nonNull("String")),
    }),
  };
  return s.schema(types);
}
