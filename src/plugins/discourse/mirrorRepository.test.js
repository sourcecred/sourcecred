// @flow

import Database from "better-sqlite3";
import fs from "fs";
import tmp from "tmp";
import {SqliteMirrorRepository} from "./mirrorRepository";
import type {Topic, Post} from "./fetch";

describe("plugins/discourse/mirrorRepository", () => {
  it("rejects a different server url without changing the database", () => {
    // We use an on-disk database file here so that we can dump the
    // contents to ensure that the database is physically unchanged.
    const filename = tmp.fileSync().name;
    const db = new Database(filename);
    const url1 = "https://foo.bar";
    const url2 = "https://foo.zod";
    expect(() => new SqliteMirrorRepository(db, url1)).not.toThrow();
    const data = fs.readFileSync(filename).toJSON();

    expect(() => new SqliteMirrorRepository(db, url2)).toThrow(
      "incompatible server or version"
    );
    expect(fs.readFileSync(filename).toJSON()).toEqual(data);

    expect(() => new SqliteMirrorRepository(db, url1)).not.toThrow();
    expect(fs.readFileSync(filename).toJSON()).toEqual(data);
  });

  it("findUsername does a case-insensitive query", () => {
    // Given
    const db = new Database(":memory:");
    const url = "http://example.com";
    const username = "PascalFan1988";
    const repository = new SqliteMirrorRepository(db, url);

    // When
    repository.addUser(username);
    const result1 = repository.findUsername("pascalfan1988");
    const result2 = repository.findUsername(username);

    // Then
    expect(result1).toEqual(username);
    expect(result2).toEqual(username);
  });

  it("bumpedMsForTopic finds an existing topic's bumpedMs", () => {
    // Given
    const db = new Database(":memory:");
    const url = "http://example.com";
    const repository = new SqliteMirrorRepository(db, url);
    const topic: Topic = {
      id: 123,
      categoryId: 1,
      title: "Sample topic",
      timestampMs: 456789,
      bumpedMs: 456999,
      authorUsername: "credbot",
    };

    // When
    repository.addTopic(topic);
    const bumpedMs = repository.bumpedMsForTopic(topic.id);

    // Then
    expect(bumpedMs).toEqual(topic.bumpedMs);
  });

  it("syncHeads finds an an existing topic's bumpedMs", () => {
    // Given
    const db = new Database(":memory:");
    const url = "http://example.com";
    const repository = new SqliteMirrorRepository(db, url);
    const topic: Topic = {
      id: 123,
      categoryId: 1,
      title: "Sample topic",
      timestampMs: 456789,
      bumpedMs: 456999,
      authorUsername: "credbot",
    };

    // When
    repository.addTopic(topic);
    const syncHeads = repository.syncHeads();

    // Then
    expect(syncHeads).toEqual({
      definitionCheckMs: 0,
      topicBumpMs: topic.bumpedMs,
    });
  });

  it("syncHeads stores and recalls a bumpDefinitionTopicCheck", () => {
    // Given
    const db = new Database(":memory:");
    const url = "http://example.com";
    const repository = new SqliteMirrorRepository(db, url);
    const definitionCheckMs = 617283;

    // When
    repository.bumpDefinitionTopicCheck(definitionCheckMs);
    const syncHeads = repository.syncHeads();

    // Then
    expect(syncHeads).toEqual({
      definitionCheckMs,
      topicBumpMs: 0,
    });
  });

  it("bumpedMsForTopic returns null when missing topic", () => {
    // Given
    const db = new Database(":memory:");
    const url = "http://example.com";
    const repository = new SqliteMirrorRepository(db, url);

    // When
    const bumpedMs = repository.bumpedMsForTopic(123);

    // Then
    expect(bumpedMs).toEqual(null);
  });

  it("replaceTopicTransaction finds and prunes old posts", () => {
    // Given
    const db = new Database(":memory:");
    const url = "http://example.com";
    const repository = new SqliteMirrorRepository(db, url);
    const topic: Topic = {
      id: 123,
      categoryId: 1,
      title: "Sample topic",
      timestampMs: 456789,
      bumpedMs: 456999,
      authorUsername: "credbot",
    };
    const p1: Post = {
      id: 100,
      topicId: 123,
      indexWithinTopic: 0,
      replyToPostIndex: null,
      timestampMs: 456789,
      authorUsername: "credbot",
      cooked: "<p>Valid post</p>",
    };
    const p2: Post = {
      id: 101,
      topicId: 123,
      indexWithinTopic: 1,
      replyToPostIndex: null,
      timestampMs: 456888,
      authorUsername: "credbot",
      cooked: "<p>Follow up 1</p>",
    };
    const p3: Post = {
      id: 102,
      topicId: 123,
      indexWithinTopic: 1,
      replyToPostIndex: null,
      timestampMs: 456999,
      authorUsername: "credbot",
      cooked: "<p>Follow up, replacement</p>",
    };

    // When
    repository.replaceTopicTransaction(topic, [p1, p2]);
    repository.replaceTopicTransaction(topic, [p1, p3]);
    const topics = repository.topics();
    const posts = repository.posts();

    // Then
    expect(topics).toEqual([topic]);
    expect(posts).toEqual([p1, p3]);
  });

  it("throws and rolls back a replaceTopicTransaction error", () => {
    // Given
    const db = new Database(":memory:");
    const url = "http://example.com";
    const repository = new SqliteMirrorRepository(db, url);
    const topic: Topic = {
      id: 123,
      categoryId: 1,
      title: "Sample topic",
      timestampMs: 456789,
      bumpedMs: 456999,
      authorUsername: "credbot",
    };
    const posts: Post[] = [
      {
        id: 456,
        topicId: 123,
        indexWithinTopic: 0,
        replyToPostIndex: null,
        timestampMs: 456789,
        authorUsername: "credbot",
        cooked: "<p>Valid post</p>",
      },
      {
        id: 456,
        topicId: 666,
        indexWithinTopic: 0,
        replyToPostIndex: null,
        timestampMs: 456999,
        authorUsername: "credbot",
        cooked: "<p>Invalid post, topic ID foreign key constraint.</p>",
      },
    ];

    // When
    let error: Error | null = null;
    try {
      repository.replaceTopicTransaction(topic, posts);
    } catch (e) {
      error = e;
    }
    const actualTopics = repository.topics();
    const actualPosts = repository.posts();

    // Then
    expect(actualTopics).toEqual([]);
    expect(actualPosts).toEqual([]);
    expect(() => {
      if (error) throw error;
    }).toThrow("FOREIGN KEY constraint failed");
  });

  it("topicById gets the matching topics", () => {
    // Given
    const db = new Database(":memory:");
    const url = "http://example.com";
    const repository = new SqliteMirrorRepository(db, url);
    const topic1: Topic = {
      id: 123,
      categoryId: 42,
      title: "Sample topic 1",
      timestampMs: 456789,
      bumpedMs: 456999,
      authorUsername: "credbot",
    };
    const topic2: Topic = {
      id: 456,
      categoryId: 42,
      title: "Sample topic 2",
      timestampMs: 456789,
      bumpedMs: 456999,
      authorUsername: "credbot",
    };

    // When
    repository.addTopic(topic1);
    repository.addTopic(topic2);
    const actualT1 = repository.topicById(topic1.id);
    const actualT2 = repository.topicById(topic2.id);

    // Then
    expect(actualT1).toEqual(topic1);
    expect(actualT2).toEqual(topic2);
  });
});
