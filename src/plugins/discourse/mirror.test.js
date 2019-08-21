// @flow

import sortBy from "lodash.sortby";
import Database from "better-sqlite3";
import fs from "fs";
import tmp from "tmp";
import {Mirror} from "./mirror";
import {
  type Discourse,
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
  +indexWithinTopic: number,
  +replyToPostIndex: number | null,
  +topicId: number,
  +authorUsername: string,
|};

class MockFetcher implements Discourse {
  _latestTopicId: number;
  _latestPostId: number;
  _topicToPostIds: Map<TopicId, PostId[]>;
  _posts: Map<PostId, PostInfo>;
  _likes: LikeAction[];

  constructor() {
    this._latestTopicId = 1;
    this._latestPostId = 1;
    this._topicToPostIds = new Map();
    this._posts = new Map();
    this._likes = [];
  }

  async latestTopicId(): Promise<TopicId> {
    return this._latestTopicId;
  }

  async latestPosts(): Promise<Post[]> {
    const latestPost = this._post(this._latestPostId - 1);
    if (latestPost == null) {
      return [];
    }
    return [latestPost];
  }

  async topicWithPosts(id: TopicId): Promise<TopicWithPosts | null> {
    const postIds = this._topicToPostIds.get(id);
    if (postIds == null || postIds.length === 0) {
      return null;
    }
    const firstPost = this._post(postIds[0]);
    if (firstPost == null) {
      throw new Error("invalid firstPost");
    }
    // Only return the first post in the posts array, to ensure that we have to
    // test the functionality where we manually grab posts by ID
    const posts = [firstPost];
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

  _topic(id: TopicId): Topic {
    return {
      id,
      title: `topic ${id}`,
      timestampMs: 1000,
      authorUsername: "credbot",
    };
  }

  async post(id: PostId): Promise<Post | null> {
    return this._post(id);
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
    } = postInfo;
    return {
      id,
      timestampMs: 2003,
      replyToPostIndex,
      topicId,
      indexWithinTopic,
      authorUsername,
    };
  }

  addPost(
    topicId: TopicId,
    replyToNumber: number | null,
    username?: string
  ): PostId {
    const postId = this._latestPostId++;
    this._latestTopicId = Math.max(topicId, this._latestTopicId);
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
    };
    this._posts.set(postId, postInfo);
    return postId;
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
  const example = () => {
    const fetcher = new MockFetcher();
    const db = new Database(":memory:");
    const url = "http://example.com";
    const mirror = new Mirror(db, fetcher, url);
    const reporter = new TestTaskReporter();
    return {fetcher, mirror, reporter, url};
  };

  it("rejects a different server url without changing the database", () => {
    // We use an on-disk database file here so that we can dump the
    // contents to ensure that the database is physically unchanged.
    const filename = tmp.fileSync().name;
    const db = new Database(filename);
    const fetcher = new MockFetcher();
    const url1 = "https://foo.bar";
    const url2 = "https://foo.zod";
    expect(() => new Mirror(db, fetcher, url1)).not.toThrow();
    const data = fs.readFileSync(filename).toJSON();

    expect(() => new Mirror(db, fetcher, url2)).toThrow(
      "incompatible server or version"
    );
    expect(fs.readFileSync(filename).toJSON()).toEqual(data);

    expect(() => new Mirror(db, fetcher, url1)).not.toThrow();
    expect(fs.readFileSync(filename).toJSON()).toEqual(data);
  });

  it("mirrors topics from the fetcher", async () => {
    const {mirror, fetcher, reporter} = example();
    fetcher.addPost(2, null);
    fetcher.addPost(3, null);
    const topic2 = fetcher._topic(2);
    const topic3 = fetcher._topic(3);
    await mirror.update(reporter);
    expect(mirror.topics()).toEqual([topic2, topic3]);
  });

  it("mirrors posts from the fetcher", async () => {
    const {mirror, fetcher, reporter} = example();
    const p1 = fetcher.addPost(2, null);
    const p2 = fetcher.addPost(3, null);
    const p3 = fetcher.addPost(3, 1);
    await mirror.update(reporter);
    const posts = [fetcher._post(p1), fetcher._post(p2), fetcher._post(p3)];
    expect(mirror.posts()).toEqual(posts);
  });

  it("provides usernames for all active users", async () => {
    const {mirror, fetcher, reporter} = example();
    fetcher.addPost(2, null, "alpha");
    fetcher.addPost(3, null, "beta");
    fetcher.addPost(3, 1, "alpha");
    await mirror.update(reporter);
    // credbot appears because it is the nominal author of all topics
    expect(
      mirror
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
    const {mirror, fetcher, reporter} = example();
    fetcher.addPost(1, null, "alpha");
    fetcher.addPost(2, null, "alpha");
    fetcher.addPost(3, null, "beta");
    const l1 = fetcher.addLike("beta", 1, 5);
    const l2 = fetcher.addLike("beta", 2, 6);
    const l3 = fetcher.addLike("beta", 3, 7);
    const l4 = fetcher.addLike("alpha", 1, 8);
    await mirror.update(reporter);
    expectLikesSorted(mirror.likes(), [l1, l2, l3, l4]);
    const l5 = fetcher.addLike("alpha", 2, 9);
    fetcher.addPost(4, null, "credbot");
    const l6 = fetcher.addLike("credbot", 2, 10);
    const l7 = fetcher.addLike("beta", 4, 11);
    await mirror.update(reporter);
    expectLikesSorted(mirror.likes(), [l1, l2, l3, l4, l5, l6, l7]);
  });

  it("doesn't find likes of users that never posted", async () => {
    const {mirror, fetcher, reporter} = example();
    fetcher.addPost(1, null);
    fetcher.addLike("nope", 1, 1);
    await mirror.update(reporter);
    expect(mirror.likes()).toEqual([]);
  });

  describe("update semantics", () => {
    it("only fetches new topics on `update`", async () => {
      const {mirror, fetcher, reporter} = example();
      fetcher.addPost(1, null);
      fetcher.addPost(2, null);
      await mirror.update(reporter);
      fetcher.addPost(3, null);
      const fetchTopicWithPosts = jest.spyOn(fetcher, "topicWithPosts");
      await mirror.update(reporter);
      expect(fetchTopicWithPosts).toHaveBeenCalledTimes(1);
      expect(fetchTopicWithPosts).toHaveBeenCalledWith(3);
      expect(mirror.topics().map((x) => x.id)).toEqual([1, 2, 3]);
    });

    it("gets new posts on old topics on update", async () => {
      const {mirror, fetcher, reporter} = example();
      fetcher.addPost(1, null);
      fetcher.addPost(2, null);
      await mirror.update(reporter);
      const id = fetcher.addPost(1, 1);
      fetcher.addPost(3, null);
      await mirror.update(reporter);
      const latestPosts = await fetcher.latestPosts();
      // The post added to the old topic wasn't retrieved by latest post
      expect(latestPosts.map((x) => x.id)).not.toContain(id);
      const allPostIds = mirror.posts().map((x) => x.id);
      // The post was still included, meaning the mirror scanned for new posts by id
      expect(allPostIds).toContain(id);
    });

    it("skips null/missing topics", async () => {
      const {mirror, fetcher, reporter} = example();
      fetcher.addPost(1, null);
      fetcher.addPost(3, null);
      await mirror.update(reporter);
      expect(mirror.topics().map((x) => x.id)).toEqual([1, 3]);
    });

    it("skips null/missing posts", async () => {
      const {mirror, fetcher, reporter} = example();
      const p1 = fetcher.addPost(1, null);
      fetcher._latestPostId += 2;
      const p2 = fetcher.addPost(3, null);
      await mirror.update(reporter);
      expect(mirror.posts().map((x) => x.id)).toEqual([p1, p2]);
    });

    it("queries explicitly for posts that are not present in topicWithPosts.posts", async () => {
      const {mirror, fetcher, reporter} = example();
      const p1 = fetcher.addPost(1, null);
      const p2 = fetcher.addPost(1, 1);
      const p3 = fetcher.addPost(1, 1);
      const fetchPost = jest.spyOn(fetcher, "post");
      await mirror.update(reporter);
      const getId = (x) => x.id;

      const postsFromTopic = NullUtil.get(await fetcher.topicWithPosts(1))
        .posts;
      expect(postsFromTopic.map(getId)).toEqual([p1]);

      const postsFromLatest = await fetcher.latestPosts();
      expect(postsFromLatest.map(getId)).toEqual([p3]);

      expect(fetchPost).toHaveBeenCalledTimes(1);
      expect(fetchPost).toHaveBeenCalledWith(p2);

      expect(mirror.posts().map(getId)).toEqual([p1, p2, p3]);
    });

    it("does not explicitly query for posts that were in topicWithPosts.posts", async () => {
      const {mirror, fetcher, reporter} = example();
      fetcher.addPost(1, null);
      const fetchPost = jest.spyOn(fetcher, "post");
      await mirror.update(reporter);
      expect(fetchPost).not.toHaveBeenCalled();
    });

    it("does not explicitly query for posts that were provided in latest posts", async () => {
      const {mirror, fetcher, reporter} = example();
      fetcher.addPost(1, null);
      await mirror.update(reporter);
      const id = fetcher.addPost(1, 1);
      const fetchPost = jest.spyOn(fetcher, "post");
      await mirror.update(reporter);
      expect(fetchPost).not.toHaveBeenCalled();
      expect(mirror.posts().map((x) => x.id)).toContain(id);
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
  });

  it("sends the right tasks to the TaskReporter", async () => {
    const {mirror, fetcher, reporter} = example();
    fetcher.addPost(1, null, "credbot");
    await mirror.update(reporter);
    expect(reporter.activeTasks()).toEqual([]);
    expect(reporter.entries()).toEqual([
      {type: "START", taskId: "discourse"},
      {type: "START", taskId: "discourse/topics"},
      {type: "FINISH", taskId: "discourse/topics"},
      {type: "START", taskId: "discourse/posts"},
      {type: "FINISH", taskId: "discourse/posts"},
      {type: "START", taskId: "discourse/likes"},
      {type: "FINISH", taskId: "discourse/likes"},
      {type: "FINISH", taskId: "discourse"},
    ]);
  });

  describe("findPostInTopic", () => {
    it("works for the first post in a topic", async () => {
      const {mirror, fetcher, reporter} = example();
      const id = fetcher.addPost(5, null);
      const post = NullUtil.get(fetcher._post(id));
      expect(post.topicId).toEqual(5);
      expect(post.indexWithinTopic).toEqual(1);
      await mirror.update(reporter);
      expect(mirror.findPostInTopic(5, 1)).toEqual(id);
    });

    it("works for the second post in a topic", async () => {
      const {mirror, fetcher, reporter} = example();
      fetcher.addPost(1, null);
      const id = fetcher.addPost(1, 1);
      const post = NullUtil.get(fetcher._post(id));
      expect(post.indexWithinTopic).toEqual(2);
      await mirror.update(reporter);
      expect(mirror.findPostInTopic(1, 2)).toEqual(id);
    });

    it("returns undefined for a post with too high an index", async () => {
      const {mirror, fetcher, reporter} = example();
      fetcher.addPost(1, null);
      await mirror.update(reporter);
      expect(mirror.findPostInTopic(1, 2)).toBe(undefined);
    });

    it("returns undefined for topic that doesnt exist", async () => {
      const {mirror, fetcher, reporter} = example();
      fetcher.addPost(1, null);
      await mirror.update(reporter);
      expect(mirror.findPostInTopic(2, 1)).toBe(undefined);
    });

    it("returns undefined for a mirror that never updated", async () => {
      const {mirror} = example();
      expect(mirror.findPostInTopic(1, 1)).toBe(undefined);
    });
  });
});
