// @flow

import {Graph, type Node, type Edge} from "../../core/graph";
import {type NodeWeight} from "../../core/weights";
import {weightsForDeclaration} from "../../analysis/pluginDeclaration";
import {type WeightedGraph} from "../../core/weightedGraph";
import {
  type PostId,
  type TopicId,
  type CategoryId,
  type Tag,
  type Post,
} from "./fetch";
import {type ReadRepository} from "./mirrorRepository";
import {declaration} from "./declaration";
import {
  type DiscourseReference,
  parseLinks,
  linksToReferences,
} from "./references";
import * as NE from "./nodesAndEdges";
import {type DiscourseConfig} from "./config";
import {likeWeight} from "./weights";

export type GraphUser = {|
  +node: Node,
|};

export type GraphTopic = {|
  +node: Node,
  +hasAuthor: Edge,
|};

export type GraphPost = {|
  +topicContains: Edge,
  +node: Node,
  +hasAuthor: Edge,
  +references: $ReadOnlyArray<Edge>,
  +postReplies: Edge | null,
|};

export type GraphLike = {|
  +createsLike: Edge,
  +likes: Edge,
  +node: Node,
  +weight: NodeWeight,
|};

/**
 * TopicHasLikedPost edges connect a Topic to the posts
 * in that topic that were liked, in proportion to the
 * total like weight of the post in question.
 *
 * See: https://github.com/sourcecred/sourcecred/issues/1896
 */
export type TopicHasLikedPost = {|
  +edge: Edge,
  +weight: number,
|};

export type GraphData = {
  +users: $ReadOnlyArray<Node>,
  +topics: $ReadOnlyArray<GraphTopic>,
  +posts: $ReadOnlyArray<GraphPost>,
  +likes: $ReadOnlyArray<GraphLike>,
  +topicHasLikedPosts: $ReadOnlyArray<TopicHasLikedPost>,
};

// TODO: Make this configurable.
// For details on trust levels:
// https://blog.discourse.org/2018/06/understanding-discourse-trust-levels/
export const DEFAULT_TRUST_LEVEL_TO_WEIGHT = Object.freeze({
  "0": 0,
  // Trust level 1 indicates little engagement (doesn't even require any posts)
  // so I gave them a very small weight.
  "1": 0.1,
  // Trust level 2 in my mind indicates being a "full member" so it feels
  // like a good anchor for a standard weight of 1.
  "2": 1,
  // Trust level 3 requires that you are highly active and have earned lots of
  // likes, so feels trusted enough for some bonus minting.
  "3": 1.25,
  // Trust level 4 means you've been designated as high trust by the admins, so
  // we give a bigger bonus. Could make this even larger (2?)
  "4": 1.5,
});

export function _createGraphData(
  config: DiscourseConfig,
  repo: ReadRepository
): GraphData {
  const {serverUrl} = config;
  const users = repo.users().map((u) => NE.userNode(serverUrl, u.username));

  const topicIdToCategory = new Map<TopicId, CategoryId>();
  const topicIdToTags = new Map<TopicId, $ReadOnlyArray<Tag>>();
  const topics: $ReadOnlyArray<GraphTopic> = repo.topics().map((topic) => {
    const node = NE.topicNode(serverUrl, topic);
    topicIdToCategory.set(topic.id, topic.categoryId);
    topicIdToTags.set(topic.id, topic.tags);
    const hasAuthor = NE.authorsTopicEdge(serverUrl, topic);
    return {node, hasAuthor};
  });

  const findPostInTopic = repo.findPostInTopic.bind(repo);
  const postIdToDescription = new Map();
  const posts: $ReadOnlyArray<GraphPost> = repo.posts().map((post) => {
    const topic = repo.topicById(post.topicId);
    const topicTitle = topic != null ? topic.title : "[unknown topic]";
    const url = serverUrl + "/t/" + post.topicId + "/" + post.indexWithinTopic;
    const description = `[#${post.indexWithinTopic} on ${topicTitle}](${url})`;
    postIdToDescription.set(post.id, description);
    const node = NE.postNode(serverUrl, post, description);
    const hasAuthor = NE.authorsPostEdge(serverUrl, post);

    const references = _createReferenceEdges(serverUrl, post, findPostInTopic);

    let postReplies = null;
    let replyToPostIndex = post.replyToPostIndex;
    if (replyToPostIndex == null && post.indexWithinTopic > 1) {
      // The replyToPostIndex gets set to null if it is actually a reply to
      // the topic's own post.
      replyToPostIndex = 1;
    }
    if (replyToPostIndex != null) {
      const parentId = repo.findPostInTopic(post.topicId, replyToPostIndex);
      if (parentId != null) {
        postReplies = NE.postRepliesEdge(serverUrl, post, parentId);
      }
    }

    const topicContains = NE.topicContainsPostEdge(serverUrl, post);

    return {node, hasAuthor, references, postReplies, topicContains};
  });

  const postIdToLikeWeight = new Map();
  const likes: $ReadOnlyArray<GraphLike> = repo.likes().map((like) => {
    const postDescription =
      postIdToDescription.get(like.postId) || "[unknown post]";
    const node = NE.likeNode(serverUrl, like, postDescription);
    const createsLike = NE.createsLikeEdge(serverUrl, like);
    const likes = NE.likesEdge(serverUrl, like);
    const user = repo.findUser(like.username);
    const post = repo.postById(like.postId);
    const topicId = post ? post.topicId : null;
    let weight = 0;
    if (topicId) {
      const categoryId = topicIdToCategory.get(topicId);
      const tags = topicIdToTags.get(topicId);
      weight = likeWeight(config.weights, user, categoryId, tags);
    } else {
      weight = likeWeight(config.weights, user);
    }
    // Update how much total like weight this post has, so that we can
    // set up a hasLikedPost edge flowing cred from the topic
    const existingWeight = postIdToLikeWeight.get(like.postId) || 0;
    postIdToLikeWeight.set(like.postId, existingWeight + weight);

    return {node, createsLike, likes, weight};
  });

  const topicHasLikedPosts = [];
  for (const [postId, weight] of postIdToLikeWeight.entries()) {
    if (weight === 0) {
      // This could happen if all of the likes were from untrusted users
      continue;
    }
    const post = repo.postById(postId);
    if (post == null) {
      // The like didn't correspond to a valid post--maybe a cache/deletion
      // thing--let's ignore it.
      continue;
    }
    const edge = NE.topicHasLikedPostEdge(serverUrl, post);
    topicHasLikedPosts.push({edge, weight});
  }
  return {users, topics, posts, likes, topicHasLikedPosts};
}

export function _graphFromData({
  users,
  topics,
  posts,
  likes,
  topicHasLikedPosts,
}: GraphData): WeightedGraph {
  const g = new Graph();
  const weights = weightsForDeclaration(declaration);
  for (const user of users) {
    g.addNode(user);
  }
  for (const topic of topics) {
    g.addNode(topic.node);
    g.addEdge(topic.hasAuthor);
  }
  for (const post of posts) {
    g.addNode(post.node);
    g.addEdge(post.topicContains);
    g.addEdge(post.hasAuthor);
    if (post.postReplies != null) {
      g.addEdge(post.postReplies);
    }
    for (const reference of post.references) {
      g.addEdge(reference);
    }
  }
  for (const like of likes) {
    g.addNode(like.node);
    g.addEdge(like.createsLike);
    g.addEdge(like.likes);
    weights.nodeWeights.set(like.node.address, like.weight);
  }

  for (const {edge, weight} of topicHasLikedPosts) {
    g.addEdge(edge);
    weights.edgeWeights.set(edge.address, {forwards: weight, backwards: 0});
  }
  return {graph: g, weights};
}

export function createGraph(
  config: DiscourseConfig,
  repo: ReadRepository
): WeightedGraph {
  const data = _createGraphData(config, repo);
  return _graphFromData(data);
}

export function _createReferenceEdges(
  serverUrl: string,
  post: Post,
  findPostInTopic: (topicId: TopicId, indexWithinTopic: number) => ?PostId,
  // This is available as a helper for testing, so we don't need to construct posts
  // with fake html containing links.
  _manualLinks: ?$ReadOnlyArray<string>
): $ReadOnlyArray<Edge> {
  const links = _manualLinks
    ? _manualLinks
    : parseLinks(post.cooked, serverUrl);
  const references = linksToReferences(links);
  const result = [];
  for (const reference of references) {
    const edge = _referenceEdge(serverUrl, post, reference, findPostInTopic);
    if (edge != null) {
      result.push(edge);
    }
  }
  return result;
}

function _referenceEdge(
  serverUrl: string,
  post: Post,
  reference: DiscourseReference,
  findPostInTopic: (topicId: TopicId, indexWithinTopic: number) => ?PostId
): Edge | null {
  if (
    reference.serverUrl != null &&
    reference.serverUrl.toLowerCase() !== serverUrl.toLowerCase()
  ) {
    // Don't attempt to make cross-instance links for now, since we only
    // load one Discourse forum in a given instance.
    return null;
  }
  switch (reference.type) {
    case "TOPIC": {
      return NE.referencesTopicEdge(serverUrl, post, reference);
    }
    case "POST": {
      const referredPostId = findPostInTopic(
        reference.topicId,
        reference.postIndex
      );
      if (referredPostId == null) {
        // Maybe a bad link, or the post or topic was deleted.
        return null;
      }
      return NE.referencesPostEdge(serverUrl, post, referredPostId);
    }
    case "USER": {
      return NE.referencesUserEdge(serverUrl, post, reference);
    }
    default: {
      throw new Error(`Unexpected reference type: ${(reference.type: empty)}`);
    }
  }
}
