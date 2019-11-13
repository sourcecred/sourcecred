// @flow

import Database from "better-sqlite3";
import fs from "fs";
import tmp from "tmp";
import {SqliteMirrorRepository} from "./mirrorRepository";
import type {Topic} from "./fetch";

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

  it("topicsInCategories finds an an existing topic by categoryId", () => {
    // Given
    const db = new Database(":memory:");
    const url = "http://example.com";
    const repository = new SqliteMirrorRepository(db, url);
    const topic: Topic = {
      id: 123,
      categoryId: 42,
      title: "Sample topic",
      timestampMs: 456789,
      bumpedMs: 456999,
      authorUsername: "credbot",
    };

    // When
    repository.addTopic(topic);
    const topicIds = repository.topicsInCategories([topic.categoryId]);

    // Then
    expect(topicIds).toEqual([topic.id]);
  });

  it("topicsInCategories with several categoryIds returns all matching topics", () => {
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
      categoryId: 16,
      title: "Sample topic 2",
      timestampMs: 456789,
      bumpedMs: 456999,
      authorUsername: "credbot",
    };

    // When
    repository.addTopic(topic1);
    repository.addTopic(topic2);
    const topicIds = repository.topicsInCategories([
      topic1.categoryId,
      topic2.categoryId,
    ]);

    // Then
    expect(topicIds).toEqual([topic1.id, topic2.id]);
  });

  it("topicsInCategories without categoryIds gives no topicIds", () => {
    // Given
    const db = new Database(":memory:");
    const url = "http://example.com";
    const repository = new SqliteMirrorRepository(db, url);
    const topic: Topic = {
      id: 123,
      categoryId: 42,
      title: "Sample topic",
      timestampMs: 456789,
      bumpedMs: 456999,
      authorUsername: "credbot",
    };

    // When
    repository.addTopic(topic);
    const topicIds = repository.topicsInCategories([]);

    // Then
    expect(topicIds).toEqual([]);
  });
});
