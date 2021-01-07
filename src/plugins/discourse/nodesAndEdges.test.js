// @flow

import type {LikeAction} from "./fetch";
import {NodeAddress, EdgeAddress} from "../../core/graph";
import * as NE from "./nodesAndEdges";

import {userAddress, postAddress, likeAddress} from "./address";

describe("plugins/discourse/nodesAndEdges", () => {
  function example() {
    const url = "https://url.com";
    const topic = {
      id: 1,
      title: "first topic",
      timestampMs: 0,
      authorUsername: "decentralion",
      categoryId: 1,
      tags: ["some", "example"],
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
    return {topic, url, posts, likes};
  }

  describe("nodes are constructed correctly", () => {
    it("for users", () => {
      const {url} = example();
      const node = NE.userNode(url, "decentralion");
      expect(node.description).toMatchInlineSnapshot(
        `"discourse/[@decentralion](https://url.com/u/decentralion/)"`
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
      const node = NE.topicNode(url, topic);
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
      const {url, posts} = example();
      const description = "[#2 on first topic](https://url.com/t/1/2)";
      const node = NE.postNode(url, posts[1], description);
      expect(node.description).toEqual(description);
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

    it("for likes", () => {
      const {url, likes, posts} = example();
      const like = likes[0];
      const post = posts[1];
      expect(like.postId).toEqual(post.id);
      const postDescription = `[#2 on first topic](https://url.com/t/1/2)`;
      const node = NE.likeNode(url, like, postDescription);
      expect(node.description).toMatchInlineSnapshot(
        `"❤️ by mzargham on [#2 on first topic](https://url.com/t/1/2)"`
      );
      expect(node.timestampMs).toEqual(like.timestampMs);
      expect(NodeAddress.toParts(node.address)).toMatchInlineSnapshot(`
        Array [
          "sourcecred",
          "discourse",
          "like",
          "https://url.com",
          "mzargham",
          "2",
        ]
      `);
    });
  });

  describe("edges are constructed correctly", () => {
    it("for authorsTopic", () => {
      const {url, topic} = example();
      const expectedSrc = NE.userNode(url, topic.authorUsername).address;
      const expectedDst = NE.topicNode(url, topic).address;
      const edge = NE.authorsTopicEdge(url, topic);
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
      const expectedSrc = NE.userNode(url, post.authorUsername).address;
      const expectedDst = NE.postNode(url, post, topic.title).address;
      const edge = NE.authorsPostEdge(url, post);
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
      const expectedSrc = NE.topicNode(url, topic).address;
      const expectedDst = NE.postNode(url, post, topic.title).address;
      const edge = NE.topicContainsPostEdge(url, post);
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
    it("for topicHasLikedPost", () => {
      const {url, posts, topic} = example();
      const post = posts[1];
      const expectedSrc = NE.topicNode(url, topic).address;
      const expectedDst = NE.postNode(url, post, topic.title).address;
      const edge = NE.topicHasLikedPostEdge(url, post);
      expect(edge.src).toEqual(expectedSrc);
      expect(edge.dst).toEqual(expectedDst);
      expect(edge.timestampMs).toEqual(post.timestampMs);
      expect(EdgeAddress.toParts(edge.address)).toMatchInlineSnapshot(`
        Array [
          "sourcecred",
          "discourse",
          "topicHasLikedPost",
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
      const expectedSrc = NE.postNode(url, post, topic.title).address;
      const expectedDst = NE.postNode(url, basePost, topic.title).address;
      const edge = NE.postRepliesEdge(url, post, basePost.id);
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
    it("for likes", () => {
      const {url, likes} = example();
      const like = likes[0];
      const expectedSrc = likeAddress(url, like);
      const expectedDst = postAddress(url, like.postId);
      const edge = NE.likesEdge(url, like);
      expect(edge.src).toEqual(expectedSrc);
      expect(edge.dst).toEqual(expectedDst);
      expect(edge.timestampMs).toEqual(like.timestampMs);
      expect(EdgeAddress.toParts(edge.address)).toMatchInlineSnapshot(`
        Array [
          "sourcecred",
          "discourse",
          "likes",
          "https://url.com",
          "mzargham",
          "2",
        ]
      `);
    });
    it("for createsLike", () => {
      const {url, likes} = example();
      const like = likes[0];
      const expectedSrc = userAddress(url, like.username);
      const expectedDst = likeAddress(url, like);
      const edge = NE.createsLikeEdge(url, like);
      expect(edge.src).toEqual(expectedSrc);
      expect(edge.dst).toEqual(expectedDst);
      expect(edge.timestampMs).toEqual(like.timestampMs);
      expect(EdgeAddress.toParts(edge.address)).toMatchInlineSnapshot(`
        Array [
          "sourcecred",
          "discourse",
          "createsLike",
          "https://url.com",
          "mzargham",
          "2",
        ]
      `);
    });
  });
});
