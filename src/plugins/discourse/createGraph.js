// @flow
import {Graph, type Edge} from "../../core/graph";
import {weightsForDeclaration} from "../../analysis/pluginDeclaration";
import {type Weights} from "../../core/weights";
import {type WeightedGraph} from "../../core/weightedGraph";
import {type PostId, type TopicId, type Post, type LikeAction} from "./fetch";
import {type ReadRepository} from "./mirrorRepository";
import {declaration} from "./declaration";
import {
  type DiscourseReference,
  parseLinks,
  linksToReferences,
} from "./references";
import * as NE from "./nodesAndEdges";

export function createGraph(
  serverUrl: string,
  data: ReadRepository
): WeightedGraph {
  const gc = new _GraphCreator(serverUrl, data);
  return {graph: gc.graph, weights: gc.weights};
}

class _GraphCreator {
  graph: Graph;
  weights: Weights;
  serverUrl: string;
  data: ReadRepository;
  topicIdToTitle: Map<TopicId, string>;
  postIdToDescription: Map<PostId, string>;

  constructor(serverUrl: string, data: ReadRepository) {
    if (serverUrl.endsWith("/")) {
      throw new Error(`by convention, serverUrl should not end with /`);
    }
    this.serverUrl = serverUrl;
    this.data = data;
    this.graph = new Graph();
    this.weights = weightsForDeclaration(declaration);
    this.topicIdToTitle = new Map();
    this.postIdToDescription = new Map();

    for (const {username} of data.users()) {
      this.graph.addNode(NE.userNode(serverUrl, username));
    }

    for (const topic of data.topics()) {
      this.topicIdToTitle.set(topic.id, topic.title);
      this.graph.addNode(NE.topicNode(serverUrl, topic));
      this.graph.addEdge(NE.authorsTopicEdge(serverUrl, topic));
    }

    for (const post of data.posts()) {
      const topicTitle =
        this.topicIdToTitle.get(post.topicId) || `[unknown topic]`;
      const url = `${this.serverUrl}/t/${String(post.topicId)}/${String(
        post.indexWithinTopic
      )}`;
      const description = `[#${post.indexWithinTopic} on ${topicTitle}](${url})`;
      this.addPost(post, description);
      this.postIdToDescription.set(post.id, description);
    }

    for (const like of data.likes()) {
      this.addLike(like);
    }
  }

  addPost(post: Post, description: string) {
    this.graph.addNode(NE.postNode(this.serverUrl, post, description));
    this.graph.addEdge(NE.authorsPostEdge(this.serverUrl, post));
    this.graph.addEdge(NE.topicContainsPostEdge(this.serverUrl, post));
    this.maybeAddPostRepliesEdge(post);

    const discourseReferences = linksToReferences(
      parseLinks(post.cooked, this.serverUrl)
    );
    for (const reference of discourseReferences) {
      const edge = this.referenceEdge(post, reference);
      if (edge != null) {
        this.graph.addEdge(edge);
      }
    }
  }

  addLike(like: LikeAction) {
    const postDescription =
      this.postIdToDescription.get(like.postId) || "[unknown post]";
    this.graph.addNode(NE.likeNode(this.serverUrl, like, postDescription));
    this.graph.addEdge(NE.likesEdge(this.serverUrl, like));
    this.graph.addEdge(NE.createsLikeEdge(this.serverUrl, like));
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
        this.graph.addEdge(
          NE.postRepliesEdge(this.serverUrl, post, basePostId)
        );
      }
    }
  }

  referenceEdge(post: Post, reference: DiscourseReference): Edge | null {
    if (
      reference.serverUrl != null &&
      reference.serverUrl.toLowerCase() !== this.serverUrl.toLowerCase()
    ) {
      // Don't attempt to make cross-instance links for now, since we only
      // load one Discourse forum in a given instance.
      return null;
    }
    switch (reference.type) {
      case "TOPIC": {
        return NE.referencesTopicEdge(this.serverUrl, post, reference);
      }
      case "POST": {
        const referredPostId = this.data.findPostInTopic(
          reference.topicId,
          reference.postIndex
        );
        if (referredPostId == null) {
          // Maybe a bad link, or the post or topic was deleted.
          return null;
        }
        return NE.referencesPostEdge(this.serverUrl, post, referredPostId);
      }
      case "USER": {
        return NE.referencesUserEdge(this.serverUrl, post, reference);
      }
      default: {
        throw new Error(
          `Unexpected reference type: ${(reference.type: empty)}`
        );
      }
    }
  }
}
