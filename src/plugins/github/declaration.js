// @flow

import type {PluginDeclaration} from "../../analysis/pluginDeclaration";
import * as N from "./nodes";
import * as E from "./edges";

const repoNodeType = Object.freeze({
  name: "Repository",
  pluralName: "Repositories",
  prefix: N.Prefix.repo,
  defaultWeight: 4,
  description: "NodeType for a GitHub repository",
});

const issueNodeType = Object.freeze({
  name: "Issue",
  pluralName: "Issues",
  prefix: N.Prefix.issue,
  defaultWeight: 2,
  description: "NodeType for a GitHub issue",
});

const pullNodeType = Object.freeze({
  name: "Pull request",
  pluralName: "Pull requests",
  prefix: N.Prefix.pull,
  defaultWeight: 4,
  description: "NodeType for a GitHub pull request",
});

const reviewNodeType = Object.freeze({
  name: "Pull request review",
  pluralName: "Pull request reviews",
  prefix: N.Prefix.review,
  defaultWeight: 1,
  description: "NodeType for a GitHub code review",
});

const commentNodeType = Object.freeze({
  name: "Comment",
  pluralName: "Comments",
  prefix: N.Prefix.comment,
  defaultWeight: 1,
  description: "NodeType for a GitHub comment",
});

const userNodeType = Object.freeze({
  name: "User",
  pluralName: "Users",
  prefix: N.Prefix.user,
  defaultWeight: 1,
  description: "NodeType for a GitHub user",
});

const botNodeType = Object.freeze({
  name: "Bot",
  pluralName: "Bots",
  prefix: N.Prefix.bot,
  defaultWeight: 0.25,
  description: "NodeType for a GitHub bot account",
});

const nodeTypes = Object.freeze([
  repoNodeType,
  issueNodeType,
  pullNodeType,
  reviewNodeType,
  commentNodeType,
  userNodeType,
  botNodeType,
]);

const authorsEdgeType = Object.freeze({
  forwardName: "authors",
  backwardName: "is authored by",
  defaultForwardWeight: 1 / 2,
  defaultBackwardWeight: 1,
  prefix: E.Prefix.authors,
});

const hasParentEdgeType = Object.freeze({
  forwardName: "has parent",
  backwardName: "has child",
  defaultForwardWeight: 1,
  defaultBackwardWeight: 1 / 4,
  prefix: E.Prefix.hasParent,
});

const mergedAsEdgeType = Object.freeze({
  forwardName: "merges",
  backwardName: "is merged by",
  defaultForwardWeight: 1 / 2,
  defaultBackwardWeight: 1,
  prefix: E.Prefix.mergedAs,
});

const referencesEdgeType = Object.freeze({
  forwardName: "references",
  backwardName: "is referenced by",
  defaultForwardWeight: 1,
  defaultBackwardWeight: 1 / 16,
  prefix: E.Prefix.references,
});

const mentionsAuthorEdgeType = Object.freeze({
  forwardName: "mentions author of",
  backwardName: "has author mentioned by",
  defaultForwardWeight: 1,
  // TODO(#811): Probably change this to 0
  defaultBackwardWeight: 1 / 32,
  prefix: E.Prefix.mentionsAuthor,
});

const reactsHeartEdgeType = Object.freeze({
  forwardName: "reacted ❤️ to",
  backwardName: "got ❤️ from",
  defaultForwardWeight: 2,
  // TODO(#811): Probably change this to 0
  defaultBackwardWeight: 1 / 32,
  prefix: E.Prefix.reactsHeart,
});

const reactsThumbsUpEdgeType = Object.freeze({
  forwardName: "reacted 👍 to",
  backwardName: "got 👍 from",
  defaultForwardWeight: 1,
  // TODO(#811): Probably change this to 0
  defaultBackwardWeight: 1 / 32,
  prefix: E.Prefix.reactsThumbsUp,
});

const reactsHoorayEdgeType = Object.freeze({
  forwardName: "reacted 🎉 to",
  backwardName: "got 🎉 from",
  defaultForwardWeight: 4,
  // TODO(#811): Probably change this to 0
  defaultBackwardWeight: 1 / 32,
  prefix: E.Prefix.reactsHooray,
});

const reactsRocketEdgeType = Object.freeze({
  forwardName: "reacted 🚀 to",
  backwardName: "got 🚀 from",
  defaultForwardWeight: 1,
  // TODO(#811): Probably change this to 0
  defaultBackwardWeight: 1 / 32,
  prefix: E.Prefix.reactsRocket,
});

const edgeTypes = Object.freeze([
  authorsEdgeType,
  hasParentEdgeType,
  mergedAsEdgeType,
  referencesEdgeType,
  mentionsAuthorEdgeType,
  reactsThumbsUpEdgeType,
  reactsHeartEdgeType,
  reactsHoorayEdgeType,
  reactsRocketEdgeType,
]);

export const declaration: PluginDeclaration = Object.freeze({
  name: "GitHub",
  nodePrefix: N.Prefix.base,
  edgePrefix: E.Prefix.base,
  nodeTypes: nodeTypes,
  edgeTypes: edgeTypes,
});
