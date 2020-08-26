// @flow

import {weightsForDeclaration} from "../../analysis/pluginDeclaration";
import {Graph, type Node, type Edge} from "../../core/graph";

import {declaration} from "./declaration";
import {ReadRepository} from "./mirrorRepository";
import * as NE from "./nodesAndEdges";

export type GraphUser = {|
  +node: Node,
|};

export type GraphPost = {|
  +node: Node,
  +createsPost: Edge,
|};

export type GraphComment = {|
  +node: Node,
  +createsComment: Edge,
  +postHasReply: Edge,
|};

export type GraphLike = {|
  +likes: Edge,
|};

export type GraphData = {
  +users: $ReadOnlyArray<GraphUser>,
  +posts: $ReadOnlyArray<GraphPost>,
  +comments: $ReadOnlyArray<GraphComment>,
  +likes: $ReadOnlyArray<GraphLike>,
};

export function _createGraphData(
  serverUrl: string,
  repo: ReadRepository
): GraphData {
  const users: $ReadOnlyArray<GraphUser> = repo.users().map((user) => {
    return NE.userNode(serverUrl, user);
  });

  const posts: $ReadOnlyArray<GraphPost> = repo.posts().map((post) => {
    const node = NE.postNode(serverUrl, post);
    const createsPost = NE.createsPostEdge(serverUrl, post);
    return {node, createsPost};
  });

  const comments: $ReadOnlyArray<GraphComment> = repo
    .comments()
    .map((comment) => {
      const node = NE.commentNode(serverUrl, comment);
      const createsComment = NE.createCommentEdge(serverUrl, comment);
      const postHasReply = NE.createPostHasReplyEdge(serverUrl, comment);

      return {node, createsComment, postHasReply};
    });

  const likes = repo.likes().map((like) => {
    if (like.postId !== null) {
      return NE.createLikePostEdge(serverUrl, like);
    } else if (like.commentId !== null) {
      return NE.createLikeCommentEdge(serverUrl, like);
    }
  });

  const data = {users, posts, comments, likes};

  return data;
}

export function _graphFromData(
  {users, posts, comments, likes}: GraphData,
  trustedUsers: $ReadOnlyArray<string>
): WeightedGraph {
  const graph = new Graph();
  const weights = weightsForDeclaration(declaration);
  const usersWithPrefix = trustedUsers.map((username) => `user/${username}`);

  for (const user of users) {
    graph.addNode(user);

    if (usersWithPrefix.indexOf(user.description) !== -1) {
      weights.nodeWeights.set(user.address, 12);
    }
  }

  for (const post of posts) {
    graph.addNode(post.node);
    graph.addEdge(post.createsPost);
  }

  for (const comment of comments) {
    graph.addNode(comment.node);
    graph.addEdge(comment.createsComment);
    graph.addEdge(comment.postHasReply);
  }

  for (const like of likes) {
    graph.addEdge(like);
  }

  return {graph, weights};
}

export function createGraph(
  serverUrl: string,
  repo: ReadRepository,
  trustedUsers: $ReadOnlyArray<string>
): WeightedGraph {
  const data = _createGraphData(serverUrl, repo);
  return _graphFromData(data, trustedUsers);
}
