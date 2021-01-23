// @flow

import {max} from "d3-array";
import sortBy from "../../util/sortBy";
import Database from "better-sqlite3";
import {Mirror, type MirrorOptions} from "./mirror";
import {SqliteMirrorRepository} from "./mirrorRepository";
import {
  type Discourse,
  type CategoryId,
  type TopicId,
  type PostId,
  type Topic,
  type TopicView,
  type TopicLatest,
  type Post,
  type TopicWithPosts,
  type LikeAction,
  type User,
} from "./fetch";
import * as MapUtil from "../../util/map";
import * as NullUtil from "../../util/null";
import {SilentTaskReporter} from "../../util/taskReporter";
import {TaskManager} from "../../util/taskManager";

type TopicOptions = {|
  // Defaults to: 1 (synonymous to "uncategorized")
  categoryId?: CategoryId,
  // Defaults to: "credbot"
  authorUsername?: string,
  // Defaults to: "<h1>Hello World</h1>"
  cooked?: string,
|};

type PostOptions = {|
  topicId: TopicId,
  // Defaults to: null
  replyToPostIndex?: PostId,
  // Defaults to: "credbot"
  authorUsername?: string,
  // Defaults to: "<h1>Hello World</h1>"
  cooked?: string,
  // User trust_level
  trustLevel?: number,
|};

type PostEdits = {|
  // Defaults to: <no change>
  replyToPostIndex?: PostId,
  // Defaults to: <no change>
  timestampMs?: number,
  // Defaults to: <no change>
  cooked?: string,
|};

type CreatedCategory = {|
  +categoryId: CategoryId,
  +topicId: TopicId,
  +postId: PostId,
|};

type CreatedTopic = {|
  +topicId: TopicId,
  +postId: PostId,
|};

/**
 * A class which we can use to store and retrieve data which will act like
 * Discourses' internal data structure. We can use this to mock data for tests
 * and implement the Fetcher on top of.
 *
 * It requires you to add data in the same order as you would on an actual forum.
 * So to create a post, first a topic should exist to post in.
 * Creating a topic also creates an opening post.
 * To add a topic to a category, first you must create it.
 * Creating a category also creates a category definition topic.
 */
class MockFetcher implements Discourse {
  _nextCategoryId: CategoryId;
  _nextTopicId: TopicId;
  _nextPostId: PostId;
  _categories: Set<CategoryId>;
  _categoryDefinitionTopics: Set<TopicId>;
  _topicToCategory: Map<TopicId, CategoryId>;
  _topicToPostIds: Map<TopicId, PostId[]>;
  _posts: Map<PostId, Post>;
  _users: User[];
  _likes: LikeAction[];

  constructor() {
    // Start with 2, as category ID 1 is reserved as "uncategorized".
    this._nextCategoryId = "2";
    this._nextTopicId = 1;
    this._nextPostId = 1;
    this._categories = new Set();
    this._categoryDefinitionTopics = new Set();
    this._topicToCategory = new Map();
    this._topicToPostIds = new Map();
    this._posts = new Map();
    this._users = [];
    this._likes = [];
  }

  async categoryDefinitionTopicIds(): Promise<Set<TopicId>> {
    return this._categoryDefinitionTopics;
  }

  async topicsBumpedSince(sinceMs: number): Promise<TopicLatest[]> {
    return Array.from(this._topicToPostIds.keys())
      .filter((tid) => !this._categoryDefinitionTopics.has(tid))
      .map((tid) => this._topicLatest(tid))
      .filter((t) => t.bumpedMs > sinceMs);
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
    return {topic: this._topicView(id), posts};
  }

  async getUserData(targetUsername: string): Promise<User | null> {
    const matchingUser = this._users.find(
      ({username}) => username === targetUsername
    );
    return matchingUser || null;
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

  _topic(id: TopicId): Topic {
    const view = this._topicView(id);

    // Note: in theory this should always be a non-empty array and not produce null posts.
    // As _topicToPostIds shouldn't contain post IDs that weren't added and a Topic
    // should always have an opening post.
    const postIds = this._topicToPostIds.get(id) || [];
    const posts = NullUtil.filterList(postIds.map((pid) => this._post(pid)));

    let bumpedMs = view.timestampMs;
    // Category definition topics don't support bumping, as they are never
    // in any API responses that contain this field.
    if (!this._categoryDefinitionTopics.has(id)) {
      bumpedMs = max(posts, (p) => p.timestampMs);
    }

    return {...view, bumpedMs};
  }

  _topicLatest(topicId: TopicId): TopicLatest {
    const {id, title, timestampMs, categoryId, bumpedMs, tags} = this._topic(
      topicId
    );
    return {id, title, timestampMs, categoryId, bumpedMs, tags};
  }

  _topicView(id: TopicId): TopicView {
    if (!this._topicToPostIds.has(id)) {
      throw new Error(`Topic with ID ${id} not yet added.`);
    }

    // Find the opening post, as it defines the topic author.
    const opId = (this._topicToPostIds.get(id) || [])[0] || 0;
    const openingPost = this._post(opId);
    if (!openingPost) {
      throw new Error(`Topic with ID ${id} has no opening post.`);
    }

    const timestampMs = 1000 + id;
    return {
      id,
      categoryId: this._topicToCategory.get(id) || "1",
      tags: ["example"],
      title: `topic ${id}`,
      timestampMs,
      authorUsername: openingPost.authorUsername,
    };
  }

  _post(id: PostId): Post | null {
    return this._posts.get(id) || null;
  }

  /**
   * Adds a new Category.
   * This will create a category definition topic as well.
   * The definition topic will create an opening post.
   *
   * Note: does not have any perception of sub-categories. None of the current
   * fetcher methods make the distinction so supporting it here is unnecessary.
   */
  addCategory(topic?: $Shape<TopicOptions>): CreatedCategory {
    // Have the new Category exist.
    const categoryId = this._nextCategoryId;
    this._nextCategoryId = String(parseInt(this._nextCategoryId, 10) + 1);
    this._categories.add(categoryId);

    // Add the Topic and Post.
    const {topicId, postId} = this.addTopic({...topic, categoryId});

    // Update the mapping, now we know the category definition topic ID.
    this._categoryDefinitionTopics.add(topicId);
    return {categoryId, topicId, postId};
  }

  /**
   * Adds a new Topic.
   * The topic will create an opening post.
   *
   * Note: to set a categoryId, that category must be added first.
   */
  addTopic(topic?: TopicOptions): CreatedTopic {
    const {categoryId, authorUsername, cooked} = topic || {};
    if (categoryId === "1") {
      throw new Error(
        `Category with ID 1 is reserved as uncategorized, please don't explicitly define it.`
      );
    }
    if (categoryId && !this._categories.has(categoryId)) {
      throw new Error(`Category with ID ${categoryId} not yet added.`);
    }

    // Have the new Topic exist through an empty PostId[].
    const topicId = this._nextTopicId;
    this._nextTopicId++;
    this._topicToPostIds.set(topicId, []);

    // Add to category.
    if (categoryId != null) {
      this._topicToCategory.set(topicId, categoryId);
    }

    // Add the Post.
    const postId = this.addPost({topicId, authorUsername, cooked});

    return {topicId, postId};
  }

  /**
   * Adds a new Post.
   *
   * Note: a Topic to add this Post to must be added first.
   */
  addPost({
    topicId,
    replyToPostIndex,
    authorUsername,
    cooked,
    trustLevel,
  }: PostOptions): PostId {
    if (!this._topicToPostIds.has(topicId)) {
      throw new Error(`Topic with ID ${topicId} not yet added.`);
    }

    // Add the post.
    const postId = this._nextPostId;
    this._nextPostId++;

    // Push post into the mapping.
    const postsOnTopic = MapUtil.pushValue(
      this._topicToPostIds,
      topicId,
      postId
    );

    // Make sure the replyToPostIndex exists.
    if (replyToPostIndex != null && replyToPostIndex >= postsOnTopic.length) {
      throw new Error(
        `Invalid replyToPostIndex ${replyToPostIndex}, given ${postsOnTopic.length} in Topid ID ${topicId}`
      );
    }

    const post: Post = {
      id: postId,
      topicId: topicId,
      timestampMs: 2000 + postId,
      indexWithinTopic: postsOnTopic.length,
      replyToPostIndex: replyToPostIndex || null,
      authorUsername: authorUsername || "credbot",
      cooked: cooked || "<h1>Hello World</h1>",
      trustLevel: trustLevel || 4,
    };
    this._posts.set(postId, post);
    return postId;
  }

  /**
   * Adds a LikeAction.
   *
   * Note: a Post to add this LikeAction to must be added first.
   */
  addLike(action: LikeAction) {
    if (!this._posts.has(action.postId)) {
      throw new Error(`Post with ID ${action.postId} not yet added.`);
    }
    this._likes.push(action);
    return action;
  }

  /**
   * Edits a post.
   *
   * Only supports a limited range of edits, which is expressed by the
   * PostEdits type. Other operations would cause complex consistency
   * issues. Like moving to a different topic.
   */
  editPost(postId: PostId, changes: PostEdits): void {
    const oldPost = this._posts.get(postId);
    if (oldPost == null) {
      throw new Error(`Trying to change post ${postId} which doesn't exist.`);
    }
    const newPost = {...oldPost, ...changes};
    this._posts.set(postId, newPost);
  }

  /**
   * Deletes a post.
   */
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
      postList.filter((pid) => pid !== postId)
    );
    this._posts.delete(postId);
  }
}

describe("plugins/discourse/mirror", () => {
  function spyWarn(): JestMockFn<[string], void> {
    return ((console.warn: any): JestMockFn<any, void>);
  }
  beforeEach(() => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    try {
      expect(console.warn).not.toHaveBeenCalled();
    } finally {
      spyWarn().mockRestore();
    }
  });

  const example = (optionOverrides?: $Shape<MirrorOptions>) => {
    // Explicitly set all options, so we know what to expect in tests.
    const options: MirrorOptions = {
      recheckCategoryDefinitionsAfterMs: 3600000, // 1h
    };
    const fetcher = new MockFetcher();
    const db = new Database(":memory:");
    const url = "http://example.com";
    const repo = new SqliteMirrorRepository(db, url);
    const mirror = new Mirror(repo, fetcher, url, {
      ...options,
      ...(optionOverrides || {}),
    });
    const reporter = new SilentTaskReporter();
    const manager = new TaskManager(reporter);
    return {fetcher, mirror, reporter, manager, url, repo};
  };

  function expectLikesSorted(as, bs) {
    const s = (ls) =>
      sortBy(
        ls,
        (x) => x.username,
        (x) => x.postId
      );
    expect(s(as)).toEqual(s(bs));
  }

  describe("mirror mode 2", () => {
    it("mirrors topics from the fetcher", async () => {
      const {mirror, fetcher, manager, repo} = example();
      const t1 = fetcher.addTopic();
      const t2 = fetcher.addTopic();
      await mirror.update(manager);
      expect(repo.topics()).toEqual([
        fetcher._topic(t1.topicId),
        fetcher._topic(t2.topicId),
      ]);
    });

    it("mirrors category definition topics from the fetcher", async () => {
      const {mirror, fetcher, manager, repo} = example();
      const c1 = fetcher.addCategory();
      const t2 = fetcher.addTopic();
      await mirror.update(manager);
      expect(repo.topics()).toEqual([
        fetcher._topic(c1.topicId),
        fetcher._topic(t2.topicId),
      ]);
    });

    it("mirrors topics in a category from the fetcher", async () => {
      const {mirror, fetcher, manager, repo} = example();
      const c1 = fetcher.addCategory();
      const t2 = fetcher.addTopic({categoryId: c1.categoryId});
      await mirror.update(manager);
      expect(repo.topics()).toEqual([
        fetcher._topic(c1.topicId),
        fetcher._topic(t2.topicId),
      ]);
    });

    it("mirrors posts from the fetcher", async () => {
      const {mirror, fetcher, manager, repo} = example();
      const t1 = fetcher.addTopic();
      const t2 = fetcher.addTopic();
      const p3 = fetcher.addPost({topicId: t2.topicId});
      await mirror.update(manager);
      const posts = [
        fetcher._post(t1.postId),
        fetcher._post(t2.postId),
        fetcher._post(p3),
      ];
      expect(repo.posts()).toEqual(posts);
    });

    it("mirrors edited posts from the fetcher", async () => {
      const {mirror, fetcher, manager, repo} = example();
      const t1 = fetcher.addTopic();
      const t2 = fetcher.addTopic();
      const p3 = fetcher.addPost({topicId: t2.topicId});
      fetcher.editPost(p3, {cooked: "<p>Here's some edited content.</p>"});
      await mirror.update(manager);
      expect(repo.posts()).toEqual([
        fetcher._post(t1.postId),
        fetcher._post(t2.postId),
        fetcher._post(p3),
      ]);
      expect(repo.posts()[2].cooked).toEqual(
        "<p>Here's some edited content.</p>"
      );
    });

    it("mirrors category definition posts and normal posts from the fetcher", async () => {
      const {mirror, fetcher, manager, repo} = example();
      const c1 = fetcher.addCategory();
      const c2 = fetcher.addCategory();
      const p3 = fetcher.addPost({topicId: c2.topicId});
      const t3 = fetcher.addTopic();
      const t4 = fetcher.addTopic();
      const p6 = fetcher.addPost({topicId: t4.topicId});
      await mirror.update(manager);
      const posts = [
        fetcher._post(c1.postId),
        fetcher._post(c2.postId),
        fetcher._post(p3),
        fetcher._post(t3.postId),
        fetcher._post(t4.postId),
        fetcher._post(p6),
      ];
      expect(repo.posts()).toEqual(posts);
    });

    it("mirrors updates normal posts, not category definition posts", async () => {
      const {mirror, fetcher, manager, repo} = example();

      const c1 = fetcher.addCategory();
      const c2 = fetcher.addCategory();
      const t3 = fetcher.addTopic();
      const t4 = fetcher.addTopic();
      await mirror.update(manager);

      // Category definition post we don't expect to be updated.
      fetcher.addPost({topicId: c2.topicId});
      const p5 = fetcher.addPost({topicId: t4.topicId});
      await mirror.update(manager);

      const posts = [
        fetcher._post(c1.postId),
        fetcher._post(c2.postId),
        fetcher._post(t3.postId),
        fetcher._post(t4.postId),
        fetcher._post(p5),
      ];
      expect(repo.posts()).toEqual(posts);
    });

    it("mirrors updates normal post edits, not category definition post edits", async () => {
      const {mirror, fetcher, manager, repo} = example();

      const c1 = fetcher.addCategory();
      const c2 = fetcher.addCategory();
      const t3 = fetcher.addTopic();
      const t4 = fetcher.addTopic();
      const expectedBefore = [
        fetcher._post(c1.postId),
        fetcher._post(c2.postId),
        fetcher._post(t3.postId),
        fetcher._post(t4.postId),
      ];
      await mirror.update(manager);
      const actualBefore = repo.posts();

      // Category definition post we don't expect to be updated.
      fetcher.editPost(c2.postId, {
        cooked: `<p>Edit: changed category definition post.</p>`,
        timestampMs: Date.now(),
      });
      fetcher.editPost(t4.postId, {
        cooked: `<p>Edit: changed normal post.</p>`,
        timestampMs: Date.now(),
      });
      const expectedAfter = [
        fetcher._post(c1.postId),
        expectedBefore[1],
        fetcher._post(t3.postId),
        fetcher._post(t4.postId),
      ];
      await mirror.update(manager);
      const actualAfter = repo.posts();

      expect(actualBefore).toEqual(expectedBefore);
      expect(actualAfter).toEqual(expectedAfter);
      // Sanity check, make sure the category post was edited in the mock fetcher.
      expect(fetcher._post(c2.postId)).not.toEqual(expectedAfter[1]);
    });

    it("mirrors remainder when a post is deleted from the fetcher", async () => {
      const {mirror, fetcher, manager, repo} = example();
      const t1 = fetcher.addTopic();
      const t2 = fetcher.addTopic();
      const p3 = fetcher.addPost({topicId: t2.topicId});
      fetcher.deletePost(p3);
      await mirror.update(manager);
      expect(repo.posts()).toEqual([
        fetcher._post(t1.postId),
        fetcher._post(t2.postId),
      ]);
    });

    it("provides usernames for all active users", async () => {
      const {mirror, fetcher, manager, repo} = example();
      const [_, t2] = [
        fetcher.addTopic({authorUsername: "alpha"}),
        fetcher.addTopic({authorUsername: "beta"}),
      ];
      fetcher.addPost({
        authorUsername: "delta",
        topicId: t2.topicId,
        trustLevel: 2,
      });
      await mirror.update(manager);
      expect([...repo.users()].sort()).toEqual([
        {username: "alpha", trustLevel: 4},
        {username: "beta", trustLevel: 4},
        {username: "delta", trustLevel: 2},
      ]);
    });

    it("provides all the likes by users that have posted", async () => {
      const {mirror, fetcher, manager, repo} = example();
      const [t1, t2, t3] = [
        fetcher.addTopic({authorUsername: "alpha"}),
        fetcher.addTopic({authorUsername: "alpha"}),
        fetcher.addTopic({authorUsername: "beta"}),
      ];
      const [l1, l2, l3, l4] = [
        fetcher.addLike({
          username: "beta",
          postId: t1.postId,
          timestampMs: 5,
        }),
        fetcher.addLike({
          username: "beta",
          postId: t2.postId,
          timestampMs: 6,
        }),
        fetcher.addLike({
          username: "beta",
          postId: t3.postId,
          timestampMs: 7,
        }),
        fetcher.addLike({
          username: "alpha",
          postId: t1.postId,
          timestampMs: 8,
        }),
      ];
      await mirror.update(manager);
      expectLikesSorted(repo.likes(), [l1, l2, l3, l4]);

      const t4 = fetcher.addTopic({authorUsername: "credbot"});
      const [l5, l6, l7] = [
        fetcher.addLike({
          username: "alpha",
          postId: t2.postId,
          timestampMs: 9,
        }),
        fetcher.addLike({
          username: "credbot",
          postId: t2.postId,
          timestampMs: 10,
        }),
        fetcher.addLike({
          username: "beta",
          postId: t4.postId,
          timestampMs: 11,
        }),
      ];

      await mirror.update(manager);
      expectLikesSorted(repo.likes(), [l1, l2, l3, l4, l5, l6, l7]);
    });

    it("doesn't find likes of users that never posted", async () => {
      const {mirror, fetcher, manager, repo} = example();
      const t1 = fetcher.addTopic();
      fetcher.addLike({
        username: "nope",
        postId: t1.postId,
        timestampMs: 1,
      });
      await mirror.update(manager);
      expect(repo.likes()).toEqual([]);
    });

    it("mirrors category definition topics only after it's interval", async () => {
      const {mirror, fetcher, manager, repo} = example();

      const c1 = fetcher.addCategory();
      const topic1 = fetcher._topic(c1.topicId);
      await mirror.update(manager);
      const firstTopics = repo.topics();

      fetcher.addCategory();
      await mirror.update(manager);
      const laterTopics = repo.topics();

      expect(firstTopics).toEqual([topic1]);
      expect(laterTopics).toEqual([topic1]);
    });

    it("mirrors respects recheckCategoryDefinitionsAfterMs option", async () => {
      const {mirror, fetcher, manager, repo} = example({
        recheckCategoryDefinitionsAfterMs: 0,
      });

      const c1 = fetcher.addCategory();
      const topic1 = fetcher._topic(c1.topicId);
      await mirror.update(manager);
      const firstTopics = repo.topics();

      const c2 = fetcher.addCategory();
      const topic2 = fetcher._topic(c2.topicId);
      await mirror.update(manager);
      const laterTopics = repo.topics();

      expect(firstTopics).toEqual([topic1]);
      expect(laterTopics).toEqual([topic1, topic2]);
    });

    it("should not fetch existing topics when adding a new one on second `update`", async () => {
      const {mirror, fetcher, manager, repo} = example();
      fetcher.addTopic();
      fetcher.addTopic();
      await mirror.update(manager);
      fetcher.addTopic();
      const fetchTopicWithPosts = jest.spyOn(fetcher, "topicWithPosts");
      await mirror.update(manager);
      expect(fetchTopicWithPosts).toHaveBeenCalledTimes(1);
      expect(fetchTopicWithPosts).toHaveBeenCalledWith(3);
      expect(repo.topics().map((x) => x.id)).toEqual([1, 2, 3]);
    });

    it("gets new posts on old topics on update", async () => {
      const {mirror, fetcher, manager, repo} = example();
      const t1 = fetcher.addTopic();
      fetcher.addTopic();
      await mirror.update(manager);
      const p3 = fetcher.addPost({topicId: t1.topicId, replyToPostIndex: 1});
      fetcher.addTopic();
      await mirror.update(manager);
      const allPostIds = repo.posts().map((x) => x.id);
      expect(allPostIds).toContain(p3);
    });

    it("removes old posts on when removed from topics on update", async () => {
      const {mirror, fetcher, manager, repo} = example();
      const t1 = fetcher.addTopic();
      const p2 = fetcher.addPost({topicId: t1.topicId});
      await mirror.update(manager);

      const earlyPids = repo.posts().map((p) => p.id);
      fetcher.deletePost(p2);
      const p3 = fetcher.addPost({topicId: t1.topicId});
      await mirror.update(manager);

      const laterPids = repo.posts().map((p) => p.id);
      expect(earlyPids).toEqual([t1.postId, p2]);
      expect(laterPids).toEqual([t1.postId, p3]);
    });

    it("does not rely on incremental topic IDs", async () => {
      const {mirror, fetcher, manager, repo} = example();
      const t1 = fetcher.addTopic();
      fetcher._nextTopicId++;
      const t2 = fetcher.addTopic();
      await mirror.update(manager);
      expect(repo.topics().map((x) => x.id)).toEqual([t1.topicId, t2.topicId]);
    });

    it("does not rely on incremental post IDs", async () => {
      const {mirror, fetcher, manager, repo} = example();
      const t1 = fetcher.addTopic();
      fetcher._nextTopicId++;
      fetcher._nextPostId++;
      const t2 = fetcher.addTopic();
      await mirror.update(manager);
      expect(repo.posts().map((x) => x.id)).toEqual([t1.postId, t2.postId]);
    });

    it("does not query for topics at all if there were no new topics", async () => {
      const {mirror, fetcher, manager} = example();
      fetcher.addTopic();
      await mirror.update(manager);
      const fetchTopic = jest.spyOn(fetcher, "topicWithPosts");
      await mirror.update(manager);
      expect(fetchTopic).not.toHaveBeenCalled();
    });

    it("queries for likes for every user", async () => {
      const {mirror, fetcher, manager} = example();
      fetcher.addTopic({authorUsername: "alpha"});
      fetcher.addTopic({authorUsername: "credbot"});
      const fetchLikes = jest.spyOn(fetcher, "likesByUser");
      await mirror.update(manager);
      expect(fetchLikes).toHaveBeenCalledTimes(2);
      expect(fetchLikes).toHaveBeenCalledWith("credbot", 0);
      expect(fetchLikes).toHaveBeenCalledWith("alpha", 0);
    });

    it("queries with offset, as needed", async () => {
      const {mirror, fetcher, manager} = example();
      const [t1, t2, t3] = [
        fetcher.addTopic({authorUsername: "credbot"}),
        fetcher.addTopic({authorUsername: "credbot"}),
        fetcher.addTopic({authorUsername: "credbot"}),
      ];
      fetcher.addLike({
        username: "credbot",
        postId: t1.postId,
        timestampMs: 1,
      });
      fetcher.addLike({
        username: "credbot",
        postId: t2.postId,
        timestampMs: 2,
      });
      fetcher.addLike({
        username: "credbot",
        postId: t3.postId,
        timestampMs: 3,
      });
      const fetchLikes = jest.spyOn(fetcher, "likesByUser");
      await mirror.update(manager);
      expect(fetchLikes).toHaveBeenCalledTimes(2);
      expect(fetchLikes).toHaveBeenCalledWith("credbot", 0);
      expect(fetchLikes).toHaveBeenCalledWith("credbot", 2);
    });

    it("ceases querying once it has found all the new likes", async () => {
      const {mirror, fetcher, manager} = example();
      const [t1, t2, t3] = [
        fetcher.addTopic({authorUsername: "credbot"}),
        fetcher.addTopic({authorUsername: "credbot"}),
        fetcher.addTopic({authorUsername: "credbot"}),
      ];
      fetcher.addLike({
        username: "credbot",
        postId: t1.postId,
        timestampMs: 1,
      });
      fetcher.addLike({
        username: "credbot",
        postId: t2.postId,
        timestampMs: 2,
      });
      await mirror.update(manager);
      fetcher.addLike({
        username: "credbot",
        postId: t3.postId,
        timestampMs: 3,
      });
      const fetchLikes = jest.spyOn(fetcher, "likesByUser");
      await mirror.update(manager);
      expect(fetchLikes).toHaveBeenCalledTimes(1);
      expect(fetchLikes).toHaveBeenCalledWith("credbot", 0);
    });

    it("warns if it gets a like that doesn't correspond to any post", async () => {
      const {mirror, fetcher, manager, repo} = example();
      const t1 = fetcher.addTopic({authorUsername: "credbot"});
      const badLike = {
        username: "credbot",
        postId: 37,
        timestampMs: 0,
      };
      fetcher._likes.push(badLike);
      await mirror.update(manager);
      expect(repo.topics()).toEqual([fetcher._topic(t1.topicId)]);
      expect(repo.posts()).toEqual([fetcher._post(t1.postId)]);
      expect(repo.likes()).toEqual([]);
      expect(console.warn).toHaveBeenCalledWith(
        "Warning: Encountered error 'FOREIGN KEY constraint failed' " +
          "on a like by credbot on post id 37."
      );
      expect(console.warn).toHaveBeenCalledTimes(1);
      spyWarn().mockReset();
    });

    it("ignores if a user's likes are missing", async () => {
      const {mirror, fetcher, manager, repo} = example();
      const t1 = fetcher.addTopic({authorUsername: "credbot"});
      (fetcher: any).likesByUser = async () => null;
      await mirror.update(manager);
      expect(repo.topics()).toEqual([fetcher._topic(t1.topicId)]);
      expect(repo.posts()).toEqual([fetcher._post(t1.postId)]);
      expect(repo.likes()).toEqual([]);
    });

    it("inserts other likes if one user's likes are missing", async () => {
      const {mirror, fetcher, manager, repo} = example();
      const t1 = fetcher.addTopic({authorUsername: "credbot"});
      const p2 = fetcher.addPost({
        topicId: t1.topicId,
        authorUsername: "otheruser",
      });
      const l1 = fetcher.addLike({
        username: "otheruser",
        postId: t1.postId,
        timestampMs: 123,
      });
      const _likesByUser = fetcher.likesByUser.bind(fetcher);
      (fetcher: any).likesByUser = async (
        targetUsername: string,
        offset: number
      ) => {
        if (targetUsername === "credbot") return null;
        return await _likesByUser(targetUsername, offset);
      };
      await mirror.update(manager);
      expect(repo.topics()).toEqual([fetcher._topic(1)]);
      expect(repo.posts()).toEqual([
        fetcher._post(t1.postId),
        fetcher._post(p2),
      ]);
      expect(repo.likes()).toEqual([l1]);
    });

    it("sends the right tasks to the TaskReporter", async () => {
      const {mirror, fetcher, reporter, manager} = example();
      fetcher.addTopic({authorUsername: "credbot"});
      await mirror.update(manager);
      expect(reporter.activeTasks()).toEqual([]);
      expect(reporter.entries()).toEqual([
        {type: "START", taskId: "discourse"},
        {type: "START", taskId: "discourse/topics"},
        {type: "FINISH", taskId: "discourse/topics"},
        {type: "START", taskId: "discourse/likes"},
        {type: "FINISH", taskId: "discourse/likes"},
        {type: "FINISH", taskId: "discourse"},
      ]);
    });

    // TODO: shouldn't this be a test of MirrorRepository instead?
    // Although currently this smoke-tests the Mirror as well.
    describe("findPostInTopic", () => {
      it("works for the first post in a topic", async () => {
        const {mirror, fetcher, manager, repo} = example();
        const t1 = fetcher.addTopic();
        const post = NullUtil.get(fetcher._post(t1.postId));
        expect(post.topicId).toEqual(t1.topicId);
        expect(post.indexWithinTopic).toEqual(1);
        await mirror.update(manager);
        expect(repo.findPostInTopic(t1.topicId, 1)).toEqual(t1.postId);
      });

      it("works for the second post in a topic", async () => {
        const {mirror, fetcher, manager, repo} = example();
        const t1 = fetcher.addTopic();
        const p2 = fetcher.addPost({topicId: t1.topicId});
        const post = NullUtil.get(fetcher._post(p2));
        expect(post.indexWithinTopic).toEqual(2);
        await mirror.update(manager);
        expect(repo.findPostInTopic(t1.topicId, 2)).toEqual(p2);
      });

      it("returns undefined for a post with too high an index", async () => {
        const {mirror, fetcher, manager, repo} = example();
        const t1 = fetcher.addTopic();
        await mirror.update(manager);
        expect(repo.findPostInTopic(t1.topicId, 2)).toBe(undefined);
      });

      it("returns undefined for topic that doesnt exist", async () => {
        const {mirror, fetcher, manager, repo} = example();
        const t1 = fetcher.addTopic();
        await mirror.update(manager);
        expect(repo.findPostInTopic(t1.topicId + 1, 1)).toBe(undefined);
      });

      it("returns undefined for a mirror that never updated", async () => {
        const {repo} = example();
        expect(repo.findPostInTopic(1, 1)).toBe(undefined);
      });
    });
  });
});
