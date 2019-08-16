// @flow

import sortBy from "lodash.sortby";
import type {DiscourseData} from "./mirror";
import type {Topic, Post, PostId, TopicId} from "./fetch";
import {NodeAddress, EdgeAddress, type Node, type Edge} from "../../core/graph";
import {
  createGraph,
  userNode,
  topicNode,
  postNode,
  authorsTopicEdge,
  authorsPostEdge,
  topicContainsPostEdge,
  postRepliesEdge,
} from "./createGraph";
import {
  userNodeType,
  topicNodeType,
  postNodeType,
  authorsTopicEdgeType,
  authorsPostEdgeType,
  topicContainsPostEdgeType,
  postRepliesEdgeType,
} from "./declaration";
import type {EdgeType, NodeType} from "../../analysis/types";

describe("plugins/discourse/createGraph", () => {
  class MockData implements DiscourseData {
    _topics: $ReadOnlyArray<Topic>;
    _posts: $ReadOnlyArray<Post>;

    constructor(topics, posts) {
      this._topics = topics;
      this._posts = posts;
    }
    topics(): $ReadOnlyArray<Topic> {
      return this._topics;
    }
    posts(): $ReadOnlyArray<Post> {
      return this._posts;
    }
    users(): $ReadOnlyArray<string> {
      const users = new Set();
      for (const {authorUsername} of this.posts()) {
        users.add(authorUsername);
      }
      for (const {authorUsername} of this.topics()) {
        users.add(authorUsername);
      }
      return Array.from(users);
    }
    findPostInTopic(topicId: TopicId, indexWithinTopic: number): ?PostId {
      const post = this._posts.filter(
        (p) => p.topicId === topicId && p.indexWithinTopic === indexWithinTopic
      )[0];
      return post ? post.id : null;
    }
  }

  function example() {
    const url = "https://url.com";
    const topic = {
      id: 1,
      title: "first topic",
      timestampMs: 0,
      authorUsername: "decentralion",
    };
    const post1 = {
      id: 1,
      topicId: 1,
      indexWithinTopic: 1,
      replyToPostIndex: null,
      timestampMs: 0,
      authorUsername: "decentralion",
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
    };
    const post3 = {
      id: 3,
      topicId: 1,
      indexWithinTopic: 3,
      replyToPostIndex: 2,
      timestampMs: 1,
      authorUsername: "mzargham",
    };
    const posts = [post1, post2, post3];
    const data = new MockData([topic], [post1, post2, post3]);
    const graph = createGraph(url, data);
    return {graph, topic, url, posts};
  }

  describe("nodes are constructed correctly", () => {
    it("for users", () => {
      const {url} = example();
      const node = userNode(url, "decentralion");
      expect(node.description).toMatchInlineSnapshot(
        `"[@decentralion](https://url.com/u/decentralion/)"`
      );
      expect(node.timestampMs).toEqual(null);
      expect(NodeAddress.toParts(node.address)).toMatchInlineSnapshot(`
                Array [
                  "sourcecred",
                  "discourse",
                  "user",
                  "https://url.com",
                  "decentralion",
                ]
            `);
    });
    it("for topics", () => {
      const {url, topic} = example();
      const node = topicNode(url, topic);
      expect(node.description).toMatchInlineSnapshot(
        `"[first topic](https://url.com/t/1)"`
      );
      expect(node.timestampMs).toEqual(topic.timestampMs);
      expect(NodeAddress.toParts(node.address)).toMatchInlineSnapshot(`
                Array [
                  "sourcecred",
                  "discourse",
                  "topic",
                  "https://url.com",
                  "1",
                ]
            `);
    });
    it("for posts", () => {
      const {url, topic, posts} = example();
      const node = postNode(url, posts[1], topic.title);
      expect(node.description).toMatchInlineSnapshot(
        `"[post #2 on first topic](https://url.com/t/1/2)"`
      );
      expect(node.timestampMs).toEqual(posts[1].timestampMs);
      expect(NodeAddress.toParts(node.address)).toMatchInlineSnapshot(`
                Array [
                  "sourcecred",
                  "discourse",
                  "post",
                  "https://url.com",
                  "2",
                ]
            `);
    });
    it("gives an [unknown topic] description for posts without a matching topic", () => {
      const post = {
        id: 1,
        topicId: 1,
        indexWithinTopic: 1,
        replyToPostIndex: null,
        timestampMs: 0,
        authorUsername: "decentralion",
      };
      const data = new MockData([], [post]);
      const url = "https://foo";
      const graph = createGraph(url, data);
      const actual = Array.from(graph.nodes({prefix: postNodeType.prefix}))[0];
      const expected = postNode(url, post, "[unknown topic]");
      expect(actual).toEqual(expected);
    });
  });

  describe("edges are constructed correctly", () => {
    it("for authorsTopic", () => {
      const {url, topic} = example();
      const expectedSrc = userNode(url, topic.authorUsername).address;
      const expectedDst = topicNode(url, topic).address;
      const edge = authorsTopicEdge(url, topic);
      expect(edge.src).toEqual(expectedSrc);
      expect(edge.dst).toEqual(expectedDst);
      expect(edge.timestampMs).toEqual(topic.timestampMs);
      expect(EdgeAddress.toParts(edge.address)).toMatchInlineSnapshot(`
        Array [
          "sourcecred",
          "discourse",
          "authors",
          "topic",
          "https://url.com",
          "decentralion",
          "1",
        ]
      `);
    });
    it("for authorsPost", () => {
      const {url, posts, topic} = example();
      const post = posts[1];
      const expectedSrc = userNode(url, post.authorUsername).address;
      const expectedDst = postNode(url, post, topic.title).address;
      const edge = authorsPostEdge(url, post);
      expect(edge.src).toEqual(expectedSrc);
      expect(edge.dst).toEqual(expectedDst);
      expect(edge.timestampMs).toEqual(post.timestampMs);
      expect(EdgeAddress.toParts(edge.address)).toMatchInlineSnapshot(`
        Array [
          "sourcecred",
          "discourse",
          "authors",
          "post",
          "https://url.com",
          "wchargin",
          "2",
        ]
      `);
    });
    it("for topicContainsPost", () => {
      const {url, posts, topic} = example();
      const post = posts[1];
      const expectedSrc = topicNode(url, topic).address;
      const expectedDst = postNode(url, post, topic.title).address;
      const edge = topicContainsPostEdge(url, post);
      expect(edge.src).toEqual(expectedSrc);
      expect(edge.dst).toEqual(expectedDst);
      expect(edge.timestampMs).toEqual(post.timestampMs);
      expect(EdgeAddress.toParts(edge.address)).toMatchInlineSnapshot(`
        Array [
          "sourcecred",
          "discourse",
          "topicContainsPost",
          "https://url.com",
          "1",
          "2",
        ]
      `);
    });
    it("for postReplies", () => {
      const {url, posts, topic} = example();
      const post = posts[2];
      const basePost = posts[1];
      const expectedSrc = postNode(url, post, topic.title).address;
      const expectedDst = postNode(url, basePost, topic.title).address;
      const edge = postRepliesEdge(url, post, basePost.id);
      expect(edge.src).toEqual(expectedSrc);
      expect(edge.dst).toEqual(expectedDst);
      expect(edge.timestampMs).toEqual(post.timestampMs);
      expect(EdgeAddress.toParts(edge.address)).toMatchInlineSnapshot(`
        Array [
          "sourcecred",
          "discourse",
          "replyTo",
          "https://url.com",
          "3",
          "2",
        ]
      `);
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
      const expected = usernames.map((x) => userNode(url, x));
      expectNodesOfType(expected, userNodeType);
    });
    it("for topics", () => {
      const {url, topic} = example();
      const expected = [topicNode(url, topic)];
      expectNodesOfType(expected, topicNodeType);
    });
    it("for posts", () => {
      const {url, posts, topic} = example();
      const expected = posts.map((x) => postNode(url, x, topic.title));
      expectNodesOfType(expected, postNodeType);
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
      const topicEdge = authorsTopicEdge(url, topic);
      expectEdgesOfType([topicEdge], authorsTopicEdgeType);
    });
    it("authorsPost edges", () => {
      const {url, posts} = example();
      const postEdges = posts.map((p) => authorsPostEdge(url, p));
      expectEdgesOfType(postEdges, authorsPostEdgeType);
    });
    it("topicContainsPost edges", () => {
      const {url, posts} = example();
      const edges = posts.map((p) => topicContainsPostEdge(url, p));
      expectEdgesOfType(edges, topicContainsPostEdgeType);
    });
    it("postReplies edges", () => {
      const {url, posts} = example();
      const [post1, post2, post3] = posts;
      const edges = [
        postRepliesEdge(url, post2, post1.id),
        postRepliesEdge(url, post3, post2.id),
      ];
      expectEdgesOfType(edges, postRepliesEdgeType);
    });
  });
});
