// @flow

import {Graph, EdgeAddress, type Node, type Edge} from "../../core/graph";
import {
  type PostId,
  type TopicId,
  type Post,
  type Topic,
  type LikeAction,
} from "./fetch";
import {type DiscourseData} from "./mirror";
import {
  authorsPostEdgeType,
  authorsTopicEdgeType,
  postRepliesEdgeType,
  topicContainsPostEdgeType,
  likesEdgeType,
} from "./declaration";
import {userAddress, topicAddress, postAddress} from "./address";

export function userNode(serverUrl: string, username: string): Node {
  const url = `${serverUrl}/u/${username}/`;
  const description = `[@${username}](${url})`;
  return {
    address: userAddress(serverUrl, username),
    description,
    timestampMs: null,
  };
}

export function topicNode(serverUrl: string, topic: Topic): Node {
  const url = `${serverUrl}/t/${String(topic.id)}`;
  const description = `[${topic.title}](${url})`;
  const address = topicAddress(serverUrl, topic.id);
  return {address, description, timestampMs: topic.timestampMs};
}

export function postNode(
  serverUrl: string,
  post: Post,
  topicTitle: string
): Node {
  const url = `${serverUrl}/t/${String(post.topicId)}/${String(
    post.indexWithinTopic
  )}`;
  const descr = `[post #${post.indexWithinTopic} on ${topicTitle}](${url})`;
  const address = postAddress(serverUrl, post.id);
  return {timestampMs: post.timestampMs, address, description: descr};
}

export function authorsTopicEdge(serverUrl: string, topic: Topic): Edge {
  const address = EdgeAddress.append(
    authorsTopicEdgeType.prefix,
    serverUrl,
    topic.authorUsername,
    String(topic.id)
  );
  return {
    address,
    timestampMs: topic.timestampMs,
    src: userAddress(serverUrl, topic.authorUsername),
    dst: topicAddress(serverUrl, topic.id),
  };
}

export function authorsPostEdge(serverUrl: string, post: Post): Edge {
  const address = EdgeAddress.append(
    authorsPostEdgeType.prefix,
    serverUrl,
    post.authorUsername,
    String(post.id)
  );
  return {
    address,
    timestampMs: post.timestampMs,
    src: userAddress(serverUrl, post.authorUsername),
    dst: postAddress(serverUrl, post.id),
  };
}

export function topicContainsPostEdge(serverUrl: string, post: Post): Edge {
  const address = EdgeAddress.append(
    topicContainsPostEdgeType.prefix,
    serverUrl,
    String(post.topicId),
    String(post.id)
  );
  return {
    address,
    timestampMs: post.timestampMs,
    src: topicAddress(serverUrl, post.topicId),
    dst: postAddress(serverUrl, post.id),
  };
}

export function postRepliesEdge(
  serverUrl: string,
  post: Post,
  basePostId: PostId
): Edge {
  const address = EdgeAddress.append(
    postRepliesEdgeType.prefix,
    serverUrl,
    String(post.id),
    String(basePostId)
  );
  return {
    address,
    timestampMs: post.timestampMs,
    src: postAddress(serverUrl, post.id),
    dst: postAddress(serverUrl, basePostId),
  };
}

export function likesEdge(serverUrl: string, like: LikeAction): Edge {
  const address = EdgeAddress.append(
    likesEdgeType.prefix,
    serverUrl,
    like.username,
    String(like.postId)
  );
  return {
    address,
    timestampMs: like.timestampMs,
    src: userAddress(serverUrl, like.username),
    dst: postAddress(serverUrl, like.postId),
  };
}

export function createGraph(serverUrl: string, data: DiscourseData): Graph {
  const gc = new _GraphCreator(serverUrl, data);
  return gc.graph;
}

class _GraphCreator {
  graph: Graph;
  serverUrl: string;
  data: DiscourseData;
  topicIdToTitle: Map<TopicId, string>;

  constructor(serverUrl: string, data: DiscourseData) {
    if (serverUrl.endsWith("/")) {
      throw new Error(`by convention, serverUrl should not end with /`);
    }
    this.serverUrl = serverUrl;
    this.data = data;
    this.graph = new Graph();
    this.topicIdToTitle = new Map();

    for (const username of data.users()) {
      this.graph.addNode(userNode(serverUrl, username));
    }

    for (const topic of data.topics()) {
      this.topicIdToTitle.set(topic.id, topic.title);
      this.graph.addNode(topicNode(serverUrl, topic));
      this.graph.addEdge(authorsTopicEdge(serverUrl, topic));
    }

    for (const post of data.posts()) {
      this.addPost(post);
    }

    for (const like of data.likes()) {
      this.graph.addEdge(likesEdge(serverUrl, like));
    }
  }

  addPost(post: Post) {
    const topicTitle =
      this.topicIdToTitle.get(post.topicId) || "[unknown topic]";
    this.graph.addNode(postNode(this.serverUrl, post, topicTitle));
    this.graph.addEdge(authorsPostEdge(this.serverUrl, post));
    this.graph.addEdge(topicContainsPostEdge(this.serverUrl, post));
    this.maybeAddPostRepliesEdge(post);
  }

  /**
   * Any post that is not the first post in the thread is a reply to some post.
   * This method adds those reply edges. It is a bit hairy to work around unintuitive
   * choices in the Discourse API.
   */
  maybeAddPostRepliesEdge(post: Post) {
    let replyToPostIndex = post.replyToPostIndex;
    if (replyToPostIndex == null && post.indexWithinTopic > 1) {
      // For posts that are a reply to the first posts (or, depending on how you look at it,
      // replies to the topic), the replyToPostIndex gets set to null. For purposes of cred calculation,
      // I think replies to the first post should have a reply edge, as any other reply would.
      // So I correct for the API weirdness here.
      replyToPostIndex = 1;
    }
    if (replyToPostIndex != null) {
      const basePostId = this.data.findPostInTopic(
        post.topicId,
        replyToPostIndex
      );
      if (basePostId != null) {
        this.graph.addEdge(postRepliesEdge(this.serverUrl, post, basePostId));
      }
    }
  }
}
