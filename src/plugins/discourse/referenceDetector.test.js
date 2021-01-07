// @flow

import Database from "better-sqlite3";
import type {Topic, Post} from "./fetch";
import {SqliteMirrorRepository} from "./mirrorRepository";
import {DiscourseReferenceDetector} from "./referenceDetector";
import {type NodeAddressT, NodeAddress} from "../../core/graph";

const TEST_URL = "https://example.com";

const emptyRepository = (): SqliteMirrorRepository => {
  const db = new Database(":memory:");
  return new SqliteMirrorRepository(db, TEST_URL);
};

const maybeToParts = (a: ?NodeAddressT) => {
  return a ? NodeAddress.toParts(a) : a;
};

describe("plugins/discourse/referenceDetector", () => {
  describe("DiscourseReferenceDetector", () => {
    it("should detect user reference", () => {
      // Given
      const repo = emptyRepository();
      const detector = new DiscourseReferenceDetector(repo);
      const username = "PascalFan1988";
      repo.addOrReplaceUser({username, trustLevel: 2});

      // When
      const result = detector.addressFromUrl(`${TEST_URL}/u/pascalfan1988`);

      // Then
      expect(maybeToParts(result)).toMatchInlineSnapshot(`
        Array [
          "sourcecred",
          "discourse",
          "user",
          "https://example.com",
          "PascalFan1988",
        ]
      `);
    });

    it("should detect topic reference", () => {
      // Given
      const repo = emptyRepository();
      const detector = new DiscourseReferenceDetector(repo);
      const topic: Topic = {
        id: 123,
        categoryId: 1,
        tags: ["some", "example"],
        title: "Sample topic",
        timestampMs: 456789,
        bumpedMs: 456999,
        authorUsername: "credbot",
      };
      repo.addTopic(topic);

      // When
      const result = detector.addressFromUrl(`${TEST_URL}/t/random-slug/123`);

      // Then
      expect(maybeToParts(result)).toMatchInlineSnapshot(`
        Array [
          "sourcecred",
          "discourse",
          "topic",
          "https://example.com",
          "123",
        ]
      `);
    });

    it("should detect post reference", () => {
      // Given
      const repo = emptyRepository();
      const detector = new DiscourseReferenceDetector(repo);
      const topic: Topic = {
        id: 123,
        categoryId: 1,
        tags: ["some", "example"],
        title: "Sample topic",
        timestampMs: 456789,
        bumpedMs: 456999,
        authorUsername: "credbot",
      };
      const p1: Post = {
        id: 100,
        topicId: 123,
        indexWithinTopic: 1,
        replyToPostIndex: null,
        timestampMs: 456789,
        authorUsername: "credbot",
        cooked: "<p>Valid post</p>",
        trustLevel: 3,
      };
      repo.addTopic(topic);
      repo.addPost(p1);

      // When
      const result = detector.addressFromUrl(`${TEST_URL}/t/random-slug/123/1`);

      // Then
      expect(maybeToParts(result)).toMatchInlineSnapshot(`
        Array [
          "sourcecred",
          "discourse",
          "post",
          "https://example.com",
          "100",
        ]
      `);
    });
  });
});
