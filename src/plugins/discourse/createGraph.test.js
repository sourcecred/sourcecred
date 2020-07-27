// @flow

import sortBy from "../../util/sortBy";
import * as NullUtil from "../../util/null";
import type {ReadRepository} from "./mirrorRepository";
import type {Topic, Post, PostId, TopicId, LikeAction, User} from "./fetch";
import {EdgeAddress, type Node, type Edge} from "../../core/graph";
import {createGraph} from "./createGraph";
import * as NE from "./nodesAndEdges";

import {userAddress, postAddress, topicAddress} from "./address";

import {
  userNodeType,
  topicNodeType,
  postNodeType,
  likeNodeType,
  authorsTopicEdgeType,
  authorsPostEdgeType,
  topicContainsPostEdgeType,
  postRepliesEdgeType,
  likesEdgeType,
  createsLikeEdgeType,
  referencesTopicEdgeType,
  referencesUserEdgeType,
  referencesPostEdgeType,
} from "./declaration";
import type {EdgeType, NodeType} from "../../analysis/types";

describe("plugins/discourse/createGraph", () => {
  class MockData implements ReadRepository {
    _topics: $ReadOnlyArray<Topic>;
    _posts: $ReadOnlyArray<Post>;
    _likes: $ReadOnlyArray<LikeAction>;

    constructor(topics, posts, likes) {
      this._topics = topics;
      this._posts = posts;
      this._likes = likes;
    }
    topics(): $ReadOnlyArray<Topic> {
      return this._topics;
    }
    posts(): $ReadOnlyArray<Post> {
      return this._posts;
    }
    users(): $ReadOnlyArray<User> {
      const users = [];
      for (const {authorUsername} of this.posts()) {
        users.push({username: authorUsername, trustLevel: 3});
      }
      for (const {authorUsername} of this.topics()) {
        users.push({username: authorUsername, trustLevel: 3});
      }
      return Array.from(users);
    }
    likes(): $ReadOnlyArray<LikeAction> {
      return this._likes;
    }
    findPostInTopic(topicId: TopicId, indexWithinTopic: number): ?PostId {
      const post = this._posts.filter(
        (p) => p.topicId === topicId && p.indexWithinTopic === indexWithinTopic
      )[0];
      return post ? post.id : null;
    }
    maxIds() {
      return {
        maxPostId: this._posts.reduce((max, p) => Math.max(p.id, max), 0),
        maxTopicId: this._topics.reduce((max, t) => Math.max(t.id, max), 0),
      };
    }
    findUsername() {
      throw new Error("Method findUsername should be unused by createGraph");
    }
    topicById() {
      throw new Error("Method topicById should be unused by createGraph");
    }
  }

  function example() {
    const url = "https://url.com";
    const topic = {
      id: 1,
      title: "first topic",
      timestampMs: 0,
      authorUsername: "decentralion",
      categoryId: 1,
      bumpedMs: 0,
    };
    const post1 = {
      id: 1,
      topicId: 1,
      indexWithinTopic: 1,
      replyToPostIndex: null,
      timestampMs: 0,
      authorUsername: "decentralion",
      cooked: `<p>Some references:
      // A reference to a topic...
      <a href="https://url.com/t/first-topic/1">First topic</a>
      // A reference to a post (the slug doesn't matter)
      <a href="https://url.com/t/irrelevant-slug/1/2?u=bla">Second post</a>
      // A reference to a user
      <a href="/u/decentralion">@decentralion</a>
      // A non-reference as the url is wrong
      <a href="https://boo.com/t/first-topic/1/3">Wrong url</a>
      // No post matching this index in topic, so no reference
      <a href="https://url.com/t/first-topic/1/99">No post</a>
      // A reference to a post with different capitalization
      <a href="https://URL.com/t/irrelevant-slug/1/3?u=bla">Third post</a>
      </p>`,
      trustLevel: 3,
    };
    const post2 = {
      id: 2,
      topicId: 1,
      indexWithinTopic: 2,
      // N.B. weird but realistic: replies to the first post get a
      // replyToPostIndex of null, not 1
      replyToPostIndex: null,
      timestampMs: 1,
      authorUsername: "wchargin",
      cooked: "<h1>Hello</h1>",
      trustLevel: 3,
    };
    const post3 = {
      id: 3,
      topicId: 1,
      indexWithinTopic: 3,
      replyToPostIndex: 2,
      timestampMs: 1,
      authorUsername: "mzargham",
      cooked: "<h1>Hello</h1>",
      trustLevel: 3,
    };
    const likes: $ReadOnlyArray<LikeAction> = [
      {timestampMs: 3, username: "mzargham", postId: 2},
      {timestampMs: 4, username: "decentralion", postId: 3},
    ];
    const posts = [post1, post2, post3];
    const data = new MockData([topic], [post1, post2, post3], likes);
    const {graph} = createGraph(url, data);
    return {graph, topic, url, posts, likes};
  }

  describe("nodes are constructed correctly", () => {
    it("gives an [unknown post] description for likes without a matching post", () => {
      const {likes} = example();
      const like = likes[0];
      const data = new MockData([], [], [like]);
      const url = "https://foo";
      const {graph} = createGraph(url, data);
      const actual = Array.from(graph.nodes())[0];
      const expected = NE.likeNode(url, like, "[unknown post]");
      expect(actual).toEqual(expected);
    });

    it("gives an [unknown topic] description for posts without a matching topic", () => {
      const post = {
        id: 1,
        topicId: 1,
        indexWithinTopic: 1,
        replyToPostIndex: null,
        timestampMs: 0,
        authorUsername: "decentralion",
        cooked: "<h1>Hello</h1>",
        trustLevel: 3,
      };
      const data = new MockData([], [post], []);
      const url = "https://foo";
      const {graph} = createGraph(url, data);
      const postUrl = `${url}/t/${String(post.topicId)}/${String(
        post.indexWithinTopic
      )}`;
      const expectedDescription = `[#${post.indexWithinTopic} on [unknown topic]](${postUrl})`;
      const actual = Array.from(graph.nodes({prefix: postNodeType.prefix}))[0];
      const expected = NE.postNode(url, post, expectedDescription);
      expect(actual).toEqual(expected);
    });
  });

  describe("has the right nodes", () => {
    const addressSort = (xs) => sortBy(xs, (x) => x.address);
    function nodesOfType(t: NodeType) {
      return Array.from(example().graph.nodes({prefix: t.prefix}));
    }
    function expectNodesOfType(expected: Node[], type: NodeType) {
      expect(addressSort(expected)).toEqual(addressSort(nodesOfType(type)));
    }
    it("for users", () => {
      const {url} = example();
      const usernames = ["decentralion", "wchargin", "mzargham"];
      const expected = usernames.map((x) => NE.userNode(url, x));
      expectNodesOfType(expected, userNodeType);
    });
    it("for topics", () => {
      const {url, topic} = example();
      const expected = [NE.topicNode(url, topic)];
      expectNodesOfType(expected, topicNodeType);
    });
    it("for posts", () => {
      const {url, posts, topic} = example();
      const expected = posts.map((x) => {
        const postUrl = `${url}/t/${String(x.topicId)}/${String(
          x.indexWithinTopic
        )}`;
        const description = `[#${x.indexWithinTopic} on ${topic.title}](${postUrl})`;
        return NE.postNode(url, x, description);
      });
      expectNodesOfType(expected, postNodeType);
    });
    it("for likes", () => {
      const {url, posts, topic, likes} = example();
      const postIdToDescription = new Map();
      for (const post of posts) {
        const postUrl = `${url}/t/${String(post.topicId)}/${String(
          post.indexWithinTopic
        )}`;
        const description = `[#${post.indexWithinTopic} on ${topic.title}](${postUrl})`;
        postIdToDescription.set(post.id, description);
      }
      const expected = likes.map((x) =>
        NE.likeNode(url, x, NullUtil.get(postIdToDescription.get(x.postId)))
      );
      expectNodesOfType(expected, likeNodeType);
    });
  });

  describe("has the right edges", () => {
    const addressSort = (xs) => sortBy(xs, (x) => x.address);
    function edgesOfType(t: EdgeType) {
      return Array.from(
        example().graph.edges({addressPrefix: t.prefix, showDangling: false})
      );
    }
    function expectEdgesOfType(expected: Edge[], type: EdgeType) {
      expect(addressSort(expected)).toEqual(addressSort(edgesOfType(type)));
    }
    it("authorsTopic edges", () => {
      const {url, topic} = example();
      const topicEdge = NE.authorsTopicEdge(url, topic);
      expectEdgesOfType([topicEdge], authorsTopicEdgeType);
    });
    it("authorsPost edges", () => {
      const {url, posts} = example();
      const postEdges = posts.map((p) => NE.authorsPostEdge(url, p));
      expectEdgesOfType(postEdges, authorsPostEdgeType);
    });
    it("topicContainsPost edges", () => {
      const {url, posts} = example();
      const edges = posts.map((p) => NE.topicContainsPostEdge(url, p));
      expectEdgesOfType(edges, topicContainsPostEdgeType);
    });
    it("postReplies edges", () => {
      const {url, posts} = example();
      const [post1, post2, post3] = posts;
      const edges = [
        NE.postRepliesEdge(url, post2, post1.id),
        NE.postRepliesEdge(url, post3, post2.id),
      ];
      expectEdgesOfType(edges, postRepliesEdgeType);
    });
    it("likes edges", () => {
      const {url, likes} = example();
      const edges = likes.map((l) => NE.likesEdge(url, l));
      expectEdgesOfType(edges, likesEdgeType);
    });
    it("createsLike edges", () => {
      const {url, likes} = example();
      const edges = likes.map((l) => NE.createsLikeEdge(url, l));
      expectEdgesOfType(edges, createsLikeEdgeType);
    });
    it("references post edges", () => {
      const {url, posts} = example();
      const [post1, post2, post3] = posts;
      const firstEdge = {
        src: postAddress(url, post1.id),
        dst: postAddress(url, post2.id),
        address: EdgeAddress.append(
          referencesPostEdgeType.prefix,
          url,
          String(post1.id),
          String(post2.id)
        ),
        timestampMs: post1.timestampMs,
      };
      // Smoke test for url capitalization
      // (This second edge has incorrect URL capitalization, but is still a valid reference)
      const secondEdge = {
        src: postAddress(url, post1.id),
        dst: postAddress(url, post3.id),
        address: EdgeAddress.append(
          referencesPostEdgeType.prefix,
          url,
          String(post1.id),
          String(post3.id)
        ),
        timestampMs: post1.timestampMs,
      };
      expectEdgesOfType([firstEdge, secondEdge], referencesPostEdgeType);
    });
    it("references topic edges", () => {
      const {url, posts, topic} = example();
      const edge = {
        src: postAddress(url, posts[0].id),
        dst: topicAddress(url, topic.id),
        address: EdgeAddress.append(
          referencesTopicEdgeType.prefix,
          url,
          String(posts[0].id),
          String(topic.id)
        ),
        timestampMs: posts[0].timestampMs,
      };
      expectEdgesOfType([edge], referencesTopicEdgeType);
    });
    it("references user edges", () => {
      const {url, posts} = example();
      const edge = {
        src: postAddress(url, posts[0].id),
        dst: userAddress(url, "decentralion"),
        address: EdgeAddress.append(
          referencesUserEdgeType.prefix,
          url,
          String(posts[0].id),
          "decentralion"
        ),
        timestampMs: posts[0].timestampMs,
      };
      expectEdgesOfType([edge], referencesUserEdgeType);
    });
  });
});
