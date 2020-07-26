// @flow

import {Graph, type Node, type Edge} from "../../core/graph";
import {weightsForDeclaration} from "../../analysis/pluginDeclaration";
import {type WeightedGraph} from "../../core/weightedGraph";
import {type PostId, type TopicId, type Post} from "./fetch";
import {type ReadRepository} from "./mirrorRepository";
import {declaration} from "./declaration";
import {
  type DiscourseReference,
  parseLinks,
  linksToReferences,
} from "./references";
import * as NE from "./nodesAndEdges";

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
|};

export type GraphData = {
  +users: $ReadOnlyArray<Node>,
  +topics: $ReadOnlyArray<GraphTopic>,
  +posts: $ReadOnlyArray<GraphPost>,
  +likes: $ReadOnlyArray<GraphLike>,
};

export function _createGraphData(
  serverUrl: string,
  repo: ReadRepository
): GraphData {
  const users = repo
    .users()
    .map(({username}) => NE.userNode(serverUrl, username));

  const topicIdToTitle = new Map();
  const topics: $ReadOnlyArray<GraphTopic> = repo.topics().map((topic) => {
    const node = NE.topicNode(serverUrl, topic);
    const hasAuthor = NE.authorsTopicEdge(serverUrl, topic);
    topicIdToTitle.set(topic.id, topic.title);
    return {node, hasAuthor};
  });

  const findPostInTopic = repo.findPostInTopic.bind(repo);
  const postIdToDescription = new Map();
  const posts: $ReadOnlyArray<GraphPost> = repo.posts().map((post) => {
    const topicTitle = topicIdToTitle.get(post.topicId) || "[unknown topic]";
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

  const likes: $ReadOnlyArray<GraphLike> = repo.likes().map((like) => {
    const postDescription =
      postIdToDescription.get(like.postId) || "[unknown post]";
    const node = NE.likeNode(serverUrl, like, postDescription);
    const createsLike = NE.createsLikeEdge(serverUrl, like);
    const likes = NE.likesEdge(serverUrl, like);
    return {node, createsLike, likes};
  });
  return {users, topics, posts, likes};
}

export function _graphFromData({
  users,
  topics,
  posts,
  likes,
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
  }
  return {graph: g, weights};
}

export function createGraph(
  serverUrl: string,
  repo: ReadRepository
): WeightedGraph {
  const data = _createGraphData(serverUrl, repo);
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
