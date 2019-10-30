// @flow

import sortBy from "lodash.sortby";
import Database from "better-sqlite3";
import {Mirror, type MirrorOptions} from "./mirror";
import {SqliteMirrorRepository} from "./mirrorRepository";
import {
  type Discourse,
  type CategoryId,
  type TopicId,
  type PostId,
  type Topic,
  type Post,
  type TopicWithPosts,
  type LikeAction,
} from "./fetch";
import * as MapUtil from "../../util/map";
import * as NullUtil from "../../util/null";
import {TestTaskReporter} from "../../util/taskReporter";

type PostInfo = {|
  +timestampMs: number,
  +indexWithinTopic: number,
  +replyToPostIndex: number | null,
  +topicId: number,
  +authorUsername: string,
  +cooked: string,
|};

class MockFetcher implements Discourse {
  _latestPostId: number;
  _topicToPostIds: Map<TopicId, PostId[]>;
  _topicCategories: Map<TopicId, CategoryId>;
  _posts: Map<PostId, PostInfo>;
  _likes: LikeAction[];

  constructor() {
    this._latestPostId = 1;
    this._topicToPostIds = new Map();
    this._topicCategories = new Map();
    this._posts = new Map();
    this._likes = [];
  }

  async topicWithPosts(id: TopicId): Promise<TopicWithPosts | null> {
    const postIds = this._topicToPostIds.get(id);
    if (postIds == null || postIds.length === 0) {
      return null;
    }

    const posts = postIds.map((pid) => {
      const post = this._post(pid);
      if (post == null) {
        throw new Error(
          `MockFetcher implementation bug, mapped topic ${id} to a post ${pid} that doesn't exist.`
        );
      }
      return post;
    });

    return {topic: this._topic(id), posts};
  }

  async likesByUser(
    targetUsername: string,
    offset: number
  ): Promise<LikeAction[]> {
    const CHUNK_SIZE = 2;
    const matchingLikes = this._likes
      .filter(({username}) => username === targetUsername)
      .reverse();
    return matchingLikes.slice(offset, offset + CHUNK_SIZE);
  }

  async topicsBumpedSince(sinceMs: number): Promise<Topic[]> {
    return Array.from(this._topicToPostIds.keys())
      .filter((tid) => this._topicCategories.get(tid) != tid)
      .map((tid) => this._topic(tid))
      .filter((t) => (t.bumpedMs ? t.bumpedMs > sinceMs : false));
  }

  async categoryDefinitionTopicIds(): Promise<TopicId[]> {
    return Array.from(this._topicCategories.keys());
  }

  _topic(id: TopicId): Topic {
    const timestampMs = 1000 + id;
    const posts = (this._topicToPostIds.get(id) || []).map((pid) =>
      this._post(pid)
    );
    const maxTs = posts.reduce(
      (max, p) => (p ? Math.max(p.timestampMs, max) : max),
      timestampMs
    );
    return {
      id,
      title: `topic ${id}`,
      timestampMs,
      authorUsername: "credbot",
      categoryId: this._topicCategories.get(id) || 1,
      bumpedMs: maxTs,
    };
  }

  _post(id: PostId): Post | null {
    const postInfo = this._posts.get(id);
    if (postInfo == null) {
      return null;
    }
    const {
      replyToPostIndex,
      topicId,
      indexWithinTopic,
      authorUsername,
      cooked,
      timestampMs,
    } = postInfo;
    return {
      id,
      timestampMs,
      replyToPostIndex,
      topicId,
      indexWithinTopic,
      authorUsername,
      cooked,
    };
  }

  addCategory(topicId: TopicId): PostId {
    const postId = this.addPost(topicId, null);
    this._topicCategories.set(topicId, topicId);
    return postId;
  }

  setTopicCategory(topicId: TopicId, categoryId: CategoryId | null) {
    if (categoryId == null) {
      this._topicCategories.delete(topicId);
    } else {
      this._topicCategories.set(topicId, categoryId);
    }
  }

  addPost(
    topicId: TopicId,
    replyToNumber: number | null,
    username?: string,
    cooked?: string
  ): PostId {
    const postId = this._latestPostId++;
    const postsOnTopic = MapUtil.pushValue(
      this._topicToPostIds,
      topicId,
      postId
    );
    if (replyToNumber != null && replyToNumber >= postsOnTopic.length) {
      throw new Error("invalid replyToNumber");
    }
    const postInfo: PostInfo = {
      indexWithinTopic: postsOnTopic.length,
      replyToPostIndex: replyToNumber,
      topicId: topicId,
      authorUsername: NullUtil.orElse(username, "credbot"),
      cooked: NullUtil.orElse(cooked, "<h1>Hello World</h1>"),
      timestampMs: 2000 + postId,
    };
    this._posts.set(postId, postInfo);
    return postId;
  }

  editPost(postId: PostId, changes: $Shape<PostInfo>): void {
    const oldPost = this._posts.get(postId);
    if (oldPost == null) {
      throw new Error(`Trying to change post ${postId} which doesn't exist.`);
    }
    if (changes.topicId) {
      throw new Error("Changing a posts' topic ID is not supported.");
    }
    const newPost = {...oldPost, ...changes};
    this._posts.set(postId, newPost);
  }

  deletePost(postId: PostId) {
    const oldPost = this._posts.get(postId);
    if (oldPost == null) {
      throw new Error(`Trying to delete post ${postId} which doesn't exist.`);
    }
    const postList = this._topicToPostIds.get(oldPost.topicId);
    if (postList == null) {
      throw new Error(
        `MockFetcher implementation bug, deleting post ${postId} which doesn't have it's topic linking back to it.`
      );
    }
    this._topicToPostIds.set(
      oldPost.topicId,
      postList.filter((pid) => pid != postId)
    );
    this._posts.delete(postId);
  }

  addLike(actingUser: string, postId: PostId, timestampMs: number): LikeAction {
    if (!this._posts.has(postId)) {
      throw new Error("bad postId");
    }
    const action = {username: actingUser, postId, timestampMs};
    this._likes.push(action);
    return action;
  }
}

describe("plugins/discourse/mirror", () => {
  beforeAll(() => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });
  function spyWarn(): JestMockFn<[string], void> {
    return ((console.warn: any): JestMockFn<any, void>);
  }
  beforeEach(() => {
    spyWarn().mockReset();
  });
  afterAll(() => {
    expect(console.warn).not.toHaveBeenCalled();
    spyWarn().mockRestore();
  });
  const example = (optionOverrides?: $Shape<MirrorOptions>) => {
    // Explicitly set all options, so we know what to expect in tests.
    const options: MirrorOptions = {
      recheckCategoryDefinitionsAfterMs: 3600000, // 1h
      recheckTopicsInCategories: [],
    };
    const fetcher = new MockFetcher();
    const db = new Database(":memory:");
    const url = "http://example.com";
    const repo = new SqliteMirrorRepository(db, url);
    const mirror = new Mirror(repo, fetcher, url, {
      ...options,
      ...(optionOverrides || {}),
    });
    const reporter = new TestTaskReporter();
    return {fetcher, mirror, reporter, url, repo};
  };

  it("mirrors topics from the fetcher", async () => {
    const {mirror, fetcher, reporter, repo} = example();
    fetcher.addPost(2, null);
    fetcher.addPost(3, null);
    const topic2 = fetcher._topic(2);
    const topic3 = fetcher._topic(3);
    await mirror.update(reporter);
    expect(repo.topics()).toEqual([topic2, topic3]);
  });

  it("mirrors category definition topics from the fetcher", async () => {
    const {mirror, fetcher, reporter, repo} = example();
    fetcher.addCategory(4);
    const topic4 = fetcher._topic(4);
    await mirror.update(reporter);
    expect(repo.topics()).toEqual([topic4]);
  });

  it("mirrors category definition posts and normal posts from the fetcher", async () => {
    const {mirror, fetcher, reporter, repo} = example();
    const p1 = fetcher.addCategory(4);
    const p2 = fetcher.addCategory(5);
    const p3 = fetcher.addPost(5, 1);
    const p4 = fetcher.addPost(10, null);
    const p5 = fetcher.addPost(11, null);
    const p6 = fetcher.addPost(11, 1);
    await mirror.update(reporter);
    const posts = [
      fetcher._post(p1),
      fetcher._post(p2),
      fetcher._post(p3),
      fetcher._post(p4),
      fetcher._post(p5),
      fetcher._post(p6),
    ];
    expect(repo.posts()).toEqual(posts);
  });

  it("mirrors updates normal posts, not category definition posts", async () => {
    const {mirror, fetcher, reporter, repo} = example();

    const p1 = fetcher.addCategory(4);
    const p2 = fetcher.addCategory(5);
    const p4 = fetcher.addPost(10, null);
    const p5 = fetcher.addPost(11, null);
    await mirror.update(reporter);

    // Category definition post we don't expect to be updated.
    fetcher.addPost(5, 1);
    const p6 = fetcher.addPost(11, 1);
    await mirror.update(reporter);

    const posts = [
      fetcher._post(p1),
      fetcher._post(p2),
      fetcher._post(p4),
      fetcher._post(p5),
      fetcher._post(p6),
    ];
    expect(repo.posts()).toEqual(posts);
  });

  it("mirrors updates normal post edits, not category definition post edits", async () => {
    const {mirror, fetcher, reporter, repo} = example();

    const p1 = fetcher.addCategory(4);
    const p2 = fetcher.addCategory(5);
    const p3 = fetcher.addPost(10, null);
    const p4 = fetcher.addPost(11, null);
    const expectedBefore = [
      fetcher._post(p1),
      fetcher._post(p2),
      fetcher._post(p3),
      fetcher._post(p4),
    ];
    await mirror.update(reporter);
    const actualBefore = repo.posts();

    // Category definition post we don't expect to be updated.
    fetcher.editPost(p2, {
      cooked: `<p>Edit: changed category definition post.</p>`,
      timestampMs: Date.now(),
    });
    fetcher.editPost(p4, {
      cooked: `<p>Edit: changed normal post.</p>`,
      timestampMs: Date.now(),
    });
    const expectedAfter = [
      fetcher._post(p1),
      expectedBefore[1],
      fetcher._post(p3),
      fetcher._post(p4),
    ];
    await mirror.update(reporter);
    const actualAfter = repo.posts();

    expect(actualBefore).toEqual(expectedBefore);
    expect(actualAfter).toEqual(expectedAfter);
    // Sanity check, make sure the category post was edited in the mock fetcher.
    expect(fetcher._post(p2)).not.toEqual(expectedAfter[1]);
  });

  it("provides usernames for all active users", async () => {
    const {mirror, fetcher, reporter, repo} = example();
    fetcher.addPost(2, null, "alpha");
    fetcher.addPost(3, null, "beta");
    fetcher.addPost(3, 1, "alpha");
    await mirror.update(reporter);
    // credbot appears because it is the nominal author of all topics
    expect(
      repo
        .users()
        .slice()
        .sort()
    ).toEqual(["alpha", "beta", "credbot"]);
  });

  function expectLikesSorted(as, bs) {
    const s = (ls) => sortBy(ls, (x) => x.username, (x) => x.postId);
    expect(s(as)).toEqual(s(bs));
  }

  it("provides all the likes by users that have posted", async () => {
    const {mirror, fetcher, reporter, repo} = example();

    fetcher.addPost(1, null, "alpha");
    fetcher.addPost(2, null, "alpha");
    fetcher.addPost(3, null, "beta");
    const l1 = fetcher.addLike("beta", 1, 5);
    const l2 = fetcher.addLike("beta", 2, 6);
    const l3 = fetcher.addLike("beta", 3, 7);
    const l4 = fetcher.addLike("alpha", 1, 8);
    await mirror.update(reporter);
    expectLikesSorted(repo.likes(), [l1, l2, l3, l4]);

    const l5 = fetcher.addLike("alpha", 2, 9);
    fetcher.addPost(4, null, "credbot");
    const l6 = fetcher.addLike("credbot", 2, 10);
    const l7 = fetcher.addLike("beta", 4, 11);
    await mirror.update(reporter);
    expectLikesSorted(repo.likes(), [l1, l2, l3, l4, l5, l6, l7]);
  });

  it("doesn't find likes of users that never posted", async () => {
    const {mirror, fetcher, reporter, repo} = example();
    fetcher.addPost(1, null);
    fetcher.addLike("nope", 1, 1);
    await mirror.update(reporter);
    expect(repo.likes()).toEqual([]);
  });

  describe("update semantics", () => {
    it("mirrors category definition topics only after it's interval", async () => {
      const {mirror, fetcher, reporter, repo} = example();

      fetcher.addCategory(4);
      const topic4 = fetcher._topic(4);
      await mirror.update(reporter);
      const firstTopics = repo.topics();

      fetcher.addCategory(5);
      await mirror.update(reporter);
      const laterTopics = repo.topics();

      expect(firstTopics).toEqual([topic4]);
      expect(laterTopics).toEqual([topic4]);
    });

    it("mirrors respects recheckCategoryDefinitionsAfterMs option", async () => {
      const {mirror, fetcher, reporter, repo} = example({
        recheckCategoryDefinitionsAfterMs: 0,
      });

      fetcher.addCategory(4);
      const topic4 = fetcher._topic(4);
      await mirror.update(reporter);
      const firstTopics = repo.topics();

      fetcher.addCategory(5);
      const topic5 = fetcher._topic(5);
      await mirror.update(reporter);
      const laterTopics = repo.topics();

      expect(firstTopics).toEqual([topic4]);
      expect(laterTopics).toEqual([topic4, topic5]);
    });

    it("mirrors respects recheckTopicsInCategories option", async () => {
      const {mirror, fetcher, reporter, repo} = example({
        recheckTopicsInCategories: [4],
      });
      const cooked = "<p>New content, without bump</p>";

      // Adds a category description #4.
      // And a topic 5 which is a member of the #4 category.
      const p1 = fetcher.addPost(1, null);
      fetcher.addPost(2, null);
      fetcher.addPost(3, null);
      fetcher.addCategory(4);
      const p5 = fetcher.addPost(5, null);
      fetcher.setTopicCategory(5, 4);

      // See we're trying to update #4 and #5.
      const topicsCall = jest.spyOn(fetcher, "topicWithPosts");
      await mirror.update(reporter);

      fetcher.editPost(p1, {cooked});
      fetcher.editPost(p5, {cooked});
      const earlyCalls = [...topicsCall.mock.calls];
      topicsCall.mockClear();

      await mirror.update(reporter);
      const laterPosts = repo.posts();

      expect(fetcher._topic(4)).toMatchObject({id: 4, categoryId: 4});
      expect(fetcher._topic(5)).toMatchObject({id: 5, categoryId: 4});
      expect(fetcher._post(p5)).toMatchObject({id: 5, cooked});
      // The initial load has strict order requirements.
      expect(earlyCalls).toEqual([[1], [2], [3], [5], [4]]);
      // The update does not.
      expect(topicsCall).toHaveBeenCalledTimes(2);
      expect(topicsCall).toHaveBeenCalledWith(4);
      expect(topicsCall).toHaveBeenCalledWith(5);
      expect(laterPosts).toMatchInlineSnapshot(`
        Array [
          Object {
            "authorUsername": "credbot",
            "cooked": "<h1>Hello World</h1>",
            "id": 1,
            "indexWithinTopic": 1,
            "replyToPostIndex": null,
            "timestampMs": 2001,
            "topicId": 1,
          },
          Object {
            "authorUsername": "credbot",
            "cooked": "<h1>Hello World</h1>",
            "id": 2,
            "indexWithinTopic": 1,
            "replyToPostIndex": null,
            "timestampMs": 2002,
            "topicId": 2,
          },
          Object {
            "authorUsername": "credbot",
            "cooked": "<h1>Hello World</h1>",
            "id": 3,
            "indexWithinTopic": 1,
            "replyToPostIndex": null,
            "timestampMs": 2003,
            "topicId": 3,
          },
          Object {
            "authorUsername": "credbot",
            "cooked": "<h1>Hello World</h1>",
            "id": 4,
            "indexWithinTopic": 1,
            "replyToPostIndex": null,
            "timestampMs": 2004,
            "topicId": 4,
          },
          Object {
            "authorUsername": "credbot",
            "cooked": "<p>New content, without bump</p>",
            "id": 5,
            "indexWithinTopic": 1,
            "replyToPostIndex": null,
            "timestampMs": 2005,
            "topicId": 5,
          },
        ]
      `);
    });

    it("mirrors supports the uncategorized category in recheckTopicsInCategories option", async () => {
      const {mirror, fetcher, reporter} = example({
        recheckTopicsInCategories: [1],
      });

      // Adds a category description #4.
      // And a topic 5 which is a member of the #4 category.
      fetcher.addPost(1, null);
      fetcher.addPost(2, null);

      // See we're trying to update #4 and #5.
      const topicsCall = jest.spyOn(fetcher, "topicWithPosts");
      await mirror.update(reporter);
      const earlyCalls = [...topicsCall.mock.calls];
      topicsCall.mockClear();
      await mirror.update(reporter);

      // The initial load has strict order requirements.
      expect(earlyCalls).toEqual([[1], [2]]);
      // The update does not.
      expect(topicsCall).toHaveBeenCalledTimes(2);
      expect(topicsCall).toHaveBeenCalledWith(1);
      expect(topicsCall).toHaveBeenCalledWith(2);
    });

    it("doesn't recheck a topic more than once", async () => {
      const {mirror, fetcher, reporter} = example({
        recheckTopicsInCategories: [4],
      });

      // Adds a category description #4.
      // And a topic 5 which is a member of the #4 category.
      fetcher.addPost(1, null);
      fetcher.addPost(2, null);
      fetcher.addPost(3, null);
      fetcher.addCategory(4);
      fetcher.addPost(5, null);
      fetcher.setTopicCategory(5, 4);
      await mirror.update(reporter);

      const topicsCall = jest.spyOn(fetcher, "topicWithPosts");
      fetcher.addPost(1, 1);
      fetcher.addPost(5, 1);
      await mirror.update(reporter);

      // #1 will be updated because of the new post bump.
      // #4 will be updated because of the recheck of category.
      // #5 will be updated because of the new post bump and recheck of category.
      expect(topicsCall).toHaveBeenCalledTimes(3);
      expect(topicsCall).toHaveBeenCalledWith(1);
      expect(topicsCall).toHaveBeenCalledWith(4);
      expect(topicsCall).toHaveBeenCalledWith(5);
    });

    it("only fetches new topics on `update`", async () => {
      const {mirror, fetcher, reporter, repo} = example();
      fetcher.addPost(1, null);
      fetcher.addPost(2, null);
      await mirror.update(reporter);
      fetcher.addPost(3, null);
      const fetchTopicWithPosts = jest.spyOn(fetcher, "topicWithPosts");
      await mirror.update(reporter);
      expect(fetchTopicWithPosts).toHaveBeenCalledTimes(1);
      expect(fetchTopicWithPosts).toHaveBeenCalledWith(3);
      expect(repo.topics().map((x) => x.id)).toEqual([1, 2, 3]);
    });

    it("gets new posts on old topics on update", async () => {
      const {mirror, fetcher, reporter, repo} = example();
      fetcher.addPost(1, null);
      fetcher.addPost(2, null);
      await mirror.update(reporter);
      const id = fetcher.addPost(1, 1);
      fetcher.addPost(3, null);
      await mirror.update(reporter);
      const allPostIds = repo.posts().map((x) => x.id);
      expect(allPostIds).toContain(id);
    });

    it("removes old posts on when removed from topics on update", async () => {
      const {mirror, fetcher, reporter, repo} = example();

      const p1 = fetcher.addPost(1, null);
      const p2 = fetcher.addPost(1, 1);
      await mirror.update(reporter);
      const earlyPids = repo.posts().map((p) => p.id);
      fetcher.deletePost(p2);
      const p3 = fetcher.addPost(1, 1);
      await mirror.update(reporter);
      const laterPids = repo.posts().map((p) => p.id);

      expect(earlyPids).toEqual([p1, p2]);
      expect(laterPids).toEqual([p1, p3]);
    });

    it("does not rely on incremental topic IDs", async () => {
      const {mirror, fetcher, reporter, repo} = example();
      fetcher.addPost(1, null);
      fetcher.addPost(3, null);
      await mirror.update(reporter);
      expect(repo.topics().map((x) => x.id)).toEqual([1, 3]);
    });

    it("does not rely on incremental post IDs", async () => {
      const {mirror, fetcher, reporter, repo} = example();
      const p1 = fetcher.addPost(1, null);
      fetcher._latestPostId += 2;
      const p2 = fetcher.addPost(3, null);
      await mirror.update(reporter);
      expect(repo.posts().map((x) => x.id)).toEqual([p1, p2]);
    });

    it("does not query for topics at all if there were no new topics", async () => {
      const {mirror, fetcher, reporter} = example();
      fetcher.addPost(1, null);
      await mirror.update(reporter);
      const fetchTopic = jest.spyOn(fetcher, "topicWithPosts");
      await mirror.update(reporter);
      expect(fetchTopic).not.toHaveBeenCalled();
    });

    it("queries for likes for every user", async () => {
      const {mirror, fetcher, reporter} = example();
      fetcher.addPost(1, null, "alpha");
      const fetchLikes = jest.spyOn(fetcher, "likesByUser");
      await mirror.update(reporter);
      expect(fetchLikes).toHaveBeenCalledTimes(2);
      expect(fetchLikes).toHaveBeenCalledWith("credbot", 0);
      expect(fetchLikes).toHaveBeenCalledWith("alpha", 0);
    });

    it("queries with offset, as needed", async () => {
      const {mirror, fetcher, reporter} = example();
      fetcher.addPost(1, null, "credbot");
      fetcher.addPost(2, null, "credbot");
      fetcher.addPost(3, null, "credbot");
      fetcher.addLike("credbot", 1, 1);
      fetcher.addLike("credbot", 2, 2);
      fetcher.addLike("credbot", 3, 3);
      const fetchLikes = jest.spyOn(fetcher, "likesByUser");
      await mirror.update(reporter);
      expect(fetchLikes).toHaveBeenCalledTimes(2);
      expect(fetchLikes).toHaveBeenCalledWith("credbot", 0);
      expect(fetchLikes).toHaveBeenCalledWith("credbot", 2);
    });

    it("ceases querying once it has found all the new likes", async () => {
      const {mirror, fetcher, reporter} = example();
      fetcher.addPost(1, null, "credbot");
      fetcher.addPost(2, null, "credbot");
      fetcher.addPost(3, null, "credbot");
      fetcher.addLike("credbot", 1, 1);
      fetcher.addLike("credbot", 2, 2);
      await mirror.update(reporter);
      fetcher.addLike("credbot", 3, 3);
      const fetchLikes = jest.spyOn(fetcher, "likesByUser");
      await mirror.update(reporter);
      expect(fetchLikes).toHaveBeenCalledTimes(1);
      expect(fetchLikes).toHaveBeenCalledWith("credbot", 0);
    });

    it("warns if it gets a like that doesn't correspond to any post", async () => {
      const {mirror, fetcher, reporter, repo} = example();
      const pid = fetcher.addPost(1, null, "credbot");
      const badLike = {username: "credbot", postId: 37, timestampMs: 0};
      fetcher._likes.push(badLike);
      await mirror.update(reporter);
      expect(repo.topics()).toEqual([fetcher._topic(1)]);
      expect(repo.posts()).toEqual([fetcher._post(pid)]);
      expect(repo.likes()).toEqual([]);
      expect(console.warn).toHaveBeenCalledWith(
        "Warning: Encountered error 'FOREIGN KEY constraint failed' " +
          "on a like by credbot on post id 37."
      );
      expect(console.warn).toHaveBeenCalledTimes(1);
      jest.spyOn(console, "warn").mockImplementation(() => {});
    });
  });

  it("sends the right tasks to the TaskReporter", async () => {
    const {mirror, fetcher, reporter} = example();
    fetcher.addPost(1, null, "credbot");
    await mirror.update(reporter);
    expect(reporter.activeTasks()).toEqual([]);
    expect(reporter.entries()).toEqual([
      {type: "START", taskId: "discourse/example.com"},
      {type: "START", taskId: "discourse/example.com/topics"},
      {type: "FINISH", taskId: "discourse/example.com/topics"},
      {type: "START", taskId: "discourse/example.com/likes"},
      {type: "FINISH", taskId: "discourse/example.com/likes"},
      {type: "FINISH", taskId: "discourse/example.com"},
    ]);
  });

  describe("findPostInTopic", () => {
    it("works for the first post in a topic", async () => {
      const {mirror, fetcher, reporter, repo} = example();
      const id = fetcher.addPost(5, null);
      const post = NullUtil.get(fetcher._post(id));
      expect(post.topicId).toEqual(5);
      expect(post.indexWithinTopic).toEqual(1);
      await mirror.update(reporter);
      expect(repo.findPostInTopic(5, 1)).toEqual(id);
    });

    it("works for the second post in a topic", async () => {
      const {mirror, fetcher, reporter, repo} = example();
      fetcher.addPost(1, null);
      const id = fetcher.addPost(1, 1);
      const post = NullUtil.get(fetcher._post(id));
      expect(post.indexWithinTopic).toEqual(2);
      await mirror.update(reporter);
      expect(repo.findPostInTopic(1, 2)).toEqual(id);
    });

    it("returns undefined for a post with too high an index", async () => {
      const {mirror, fetcher, reporter, repo} = example();
      fetcher.addPost(1, null);
      await mirror.update(reporter);
      expect(repo.findPostInTopic(1, 2)).toBe(undefined);
    });

    it("returns undefined for topic that doesnt exist", async () => {
      const {mirror, fetcher, reporter, repo} = example();
      fetcher.addPost(1, null);
      await mirror.update(reporter);
      expect(repo.findPostInTopic(2, 1)).toBe(undefined);
    });

    it("returns undefined for a mirror that never updated", async () => {
      const {repo} = example();
      expect(repo.findPostInTopic(1, 1)).toBe(undefined);
    });
  });
});
