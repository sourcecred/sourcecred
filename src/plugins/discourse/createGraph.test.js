// @flow

import sortBy from "../../util/sortBy";
import * as NullUtil from "../../util/null";
import type {ReadRepository} from "./mirrorRepository";
import type {Topic, Post, PostId, TopicId, LikeAction, User} from "./fetch";
import {EdgeAddress, type Node, type Edge, Graph} from "../../core/graph";
import {
  createGraph,
  _createReferenceEdges,
  weightForTrustLevel,
  _createGraphData,
  _graphFromData,
  DEFAULT_TRUST_LEVEL_TO_WEIGHT,
} from "./createGraph";
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
      const userNames = new Set();

      for (const {authorUsername} of this.posts()) {
        userNames.add(authorUsername);
        users.push({username: authorUsername, trustLevel: 3});
      }
      for (const {authorUsername} of this.topics()) {
        if (!userNames.has(authorUsername)) {
          userNames.add(authorUsername);
          users.push({username: authorUsername, trustLevel: 3});
        }
      }
      return users;
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
    postById(id: PostId): ?Post {
      for (const p of this._posts) {
        if (p.id === id) {
          return p;
        }
      }
      return null;
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

  describe("_createReferenceEdges", () => {
    it("works for user and topic references", () => {
      const {posts, url} = example();
      const post = posts[0];
      const links = [
        url + "/u/foo",
        url + "/u/bar/",
        url + "/t/some-title/42",
        url + "/t/title-slug/1337/",
      ];
      const findPostInTopic = () => undefined;
      const edges = _createReferenceEdges(url, post, findPostInTopic, links);
      const expected = [
        NE.referencesUserEdge(url, post, {
          type: "USER",
          username: "foo",
          serverUrl: url,
        }),
        NE.referencesUserEdge(url, post, {
          type: "USER",
          username: "bar",
          serverUrl: url,
        }),
        NE.referencesTopicEdge(url, post, {
          type: "TOPIC",
          topicId: 42,
          serverUrl: url,
        }),
        NE.referencesTopicEdge(url, post, {
          type: "TOPIC",
          topicId: 1337,
          serverUrl: url,
        }),
      ];
      expect(edges).toEqual(expected);
    });
    it("works for post references", () => {
      const {posts, url} = example();
      const post = posts[0];
      const links = [
        url + "/t/some-slug/42/1",
        url + "/t/some-slug/42/2/",
        // The following two posts won't be discovered by findPostInTopic
        url + "/t/some-slug/42/3",
        url + "/t/some-slug/42/4/",
      ];
      const findPostInTopic = (_, index) => {
        switch (index) {
          case 1:
            return 1337;
          case 2:
            return 4242;
        }
      };
      const edges = _createReferenceEdges(url, post, findPostInTopic, links);
      const expected = [
        NE.referencesPostEdge(url, post, 1337),
        NE.referencesPostEdge(url, post, 4242),
      ];
      expect(edges).toEqual(expected);
    });
    it("won't match posts, topics, or users with a different serverUrl", () => {
      const {posts, url} = example();
      const otherUrl = "https://discourse.sourcecred.io";
      const post = posts[0];
      const links = [
        otherUrl + "/t/some-slug/42/1",
        otherUrl + "/t/some-slug/42",
        otherUrl + "/u/foo",
      ];
      const findPostInTopic = () => 4242;
      const edges = _createReferenceEdges(url, post, findPostInTopic, links);
      expect(edges).toEqual([]);
    });
  });

  describe("weightForTrustLevel", () => {
    it("has a weight of 0 for a null or undefined trustLevel", () => {
      expect(weightForTrustLevel(null)).toEqual(0);
      expect(weightForTrustLevel(undefined)).toEqual(0);
    });
    it("throws an error for an invalid trustLevel", () => {
      const thunk = () => weightForTrustLevel(-1);
      expect(thunk).toThrowError("invalid trust level");
    });
    it("works as expected for a regular user", () => {
      expect(weightForTrustLevel(0)).toEqual(0);
      expect(weightForTrustLevel(1)).toEqual(0.1);
      expect(weightForTrustLevel(2)).toEqual(1);
      expect(weightForTrustLevel(3)).toEqual(1.25);
      expect(weightForTrustLevel(4)).toEqual(1.5);
    });
  });

  describe("_createGraphData", () => {
    it("adds weights to likes based on user trust levels", () => {
      const like1 = {username: "foo", timestampMs: 4, postId: 42};
      const like2 = {username: "nope", timestampMs: 5, postId: 37};
      class MockData implements ReadRepository {
        topics(): $ReadOnlyArray<Topic> {
          return [];
        }
        posts(): $ReadOnlyArray<Post> {
          return [];
        }
        users(): $ReadOnlyArray<User> {
          return [{username: "foo", trustLevel: 4}];
        }
        likes(): $ReadOnlyArray<LikeAction> {
          return [like1, like2];
        }
        findPostInTopic(): ?PostId {
          throw new Error("Unused");
        }
        maxIds() {
          throw new Error("Unused");
        }
        findUsername() {
          throw new Error(
            "Method findUsername should be unused by createGraph"
          );
        }
        topicById() {
          throw new Error("Method topicById should be unused by createGraph");
        }
        postById() {
          return null;
        }
      }
      const url = "https://example.com";
      const data = _createGraphData(url, new MockData());
      const expectedData = {
        users: [NE.userNode(url, "foo")],
        topics: [],
        posts: [],
        likes: [
          {
            createsLike: expect.anything(),
            likes: expect.anything(),
            node: NE.likeNode(url, like1, "[unknown post]"),
            weight: DEFAULT_TRUST_LEVEL_TO_WEIGHT[4],
          },
          {
            createsLike: expect.anything(),
            likes: expect.anything(),
            node: NE.likeNode(url, like2, "[unknown post]"),
            // 0 weight because this user didn't appear in the data
            weight: 0,
          },
        ],
      };
      expect(data).toEqual(expectedData);
    });
  });

  describe("_graphFromData", () => {
    it("applies likes' weight", () => {
      const likeAction = {username: "foo", postId: 43, timestampMs: 17};
      const url = "";
      const graphLike = {
        node: NE.likeNode(url, likeAction, "[unknown post]"),
        createsLike: NE.createsLikeEdge(url, likeAction),
        likes: NE.likesEdge(url, likeAction),
        weight: 0.33,
      };
      const data = {
        users: [],
        topics: [],
        posts: [],
        likes: [graphLike],
      };
      const {weights, graph} = _graphFromData(data);
      const expectedGraph = new Graph()
        .addNode(graphLike.node)
        .addEdge(graphLike.createsLike)
        .addEdge(graphLike.likes);
      expect(expectedGraph.equals(graph)).toBe(true);
      expect(weights.nodeWeights.get(graphLike.node.address)).toEqual(0.33);
    });
  });
});
