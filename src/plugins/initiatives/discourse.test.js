// @flow

import {type HtmlTemplateInitiativePartial} from "./htmlTemplate";
import {initiativeFromDiscourseTracker} from "./discourse";
import type {Topic, Post} from "../discourse/fetch";
import {NodeAddress} from "../../core/graph";

function givenParseError(message: string) {
  return mockParseCookedHtml(() => {
    throw new Error(message);
  });
}

function givenParseResponse(value: HtmlTemplateInitiativePartial) {
  return mockParseCookedHtml(() => ({...value}));
}

function mockParseCookedHtml(
  fn: () => HtmlTemplateInitiativePartial
): (cookedHTML: string) => HtmlTemplateInitiativePartial {
  return jest.fn().mockImplementation(fn);
}

function exampleTopic(overrides?: $Shape<Topic>): Topic {
  return {
    id: 123,
    categoryId: 42,
    title: "Example initiative",
    timestampMs: 1571498171951,
    bumpedMs: 1571498171951,
    authorUsername: "TestUser",
    ...overrides,
  };
}

function examplePost(overrides?: $Shape<Post>): Post {
  return {
    id: 432,
    topicId: 123,
    indexWithinTopic: 1,
    replyToPostIndex: null,
    timestampMs: 1571498171951,
    authorUsername: "TestUser",
    cooked: "",
    ...overrides,
  };
}

function examplePartialIniative(
  overrides?: $Shape<HtmlTemplateInitiativePartial>
): HtmlTemplateInitiativePartial {
  return {
    completed: false,
    champions: [],
    dependencies: [],
    references: [],
    contributions: [],
    ...overrides,
  };
}

describe("plugins/initiatives/discourse", () => {
  beforeEach(() => {
    givenParseError("No parseCookedHtml mock value set");
  });

  describe("initiativeFromDiscourseTracker", () => {
    it("assumes values given by the parser", () => {
      // Given
      const serverUrl = "https://foo.bar";
      const topic = exampleTopic();
      const firstPost = examplePost();
      const partial = examplePartialIniative({
        completed: true,
        champions: ["https://foo.bar/u/ChampUser"],
        dependencies: [
          "https://foo.bar/t/dependency/1",
          "https://foo.bar/t/dependency/2",
          "https://foo.bar/t/dependency/3",
        ],
        references: [
          "https://foo.bar/t/reference/4",
          "https://foo.bar/t/reference/5/2",
          "https://foo.bar/t/reference/6/4",
        ],
        contributions: [
          "https://foo.bar/t/contribution/7",
          "https://foo.bar/t/contribution/8/2",
          "https://github.com/sourcecred/sourcecred/pull/1416",
        ],
      });
      const parser = givenParseResponse(partial);

      // When
      const initiative = initiativeFromDiscourseTracker(
        serverUrl,
        topic,
        firstPost,
        parser
      );

      // Then
      const actualPartial = {
        completed: initiative.completed,
        champions: initiative.champions,
        dependencies: initiative.dependencies,
        references: initiative.references,
        contributions: initiative.contributions,
      };
      expect(actualPartial).toEqual(partial);
    });

    it("assumes title from the topic", () => {
      // Given
      const serverUrl = "https://foo.bar";
      const topic = exampleTopic();
      topic.title = "Different title for test";
      const firstPost = examplePost();
      const partial = examplePartialIniative();
      const parser = givenParseResponse(partial);

      // When
      const initiative = initiativeFromDiscourseTracker(
        serverUrl,
        topic,
        firstPost,
        parser
      );

      // Then
      expect(initiative.title).toEqual(topic.title);
    });

    it("assumes timestamp from the post", () => {
      // Given
      const serverUrl = "https://foo.bar";
      const topic = exampleTopic();
      const firstPost = examplePost({
        timestampMs: 901236,
      });
      const partial = examplePartialIniative();
      const parser = givenParseResponse(partial);

      // When
      const initiative = initiativeFromDiscourseTracker(
        serverUrl,
        topic,
        firstPost,
        parser
      );

      // Then
      expect(initiative.timestampMs).toEqual(firstPost.timestampMs);
    });

    it("derives the tracker address from topic ID", () => {
      // Given
      const serverUrl = "https://foo.bar";
      const topic = exampleTopic({
        id: 683,
      });
      const firstPost = examplePost({
        topicId: topic.id,
      });
      const partial = examplePartialIniative();
      const parser = givenParseResponse(partial);

      // When
      const initiative = initiativeFromDiscourseTracker(
        serverUrl,
        topic,
        firstPost,
        parser
      );

      // Then
      expect(NodeAddress.toParts(initiative.tracker)).toEqual([
        "sourcecred",
        "discourse",
        "topic",
        serverUrl,
        String(topic.id),
      ]);
    });

    it("adds the serverUrl to relative URLs starting with a /", () => {
      // Given
      const serverUrl = "https://foo.bar";
      const topic = exampleTopic();
      const firstPost = examplePost();
      const parser = givenParseResponse(
        examplePartialIniative({
          champions: ["/u/ChampUser"],
          dependencies: ["/t/dependency/1"],
          references: ["/t/reference/4"],
          contributions: ["/t/contribution/7"],
        })
      );

      // When
      const initiative = initiativeFromDiscourseTracker(
        serverUrl,
        topic,
        firstPost,
        parser
      );

      // Then
      expect(initiative.champions).toEqual(["https://foo.bar/u/ChampUser"]);
      expect(initiative.dependencies).toEqual([
        "https://foo.bar/t/dependency/1",
      ]);
      expect(initiative.references).toEqual(["https://foo.bar/t/reference/4"]);
      expect(initiative.contributions).toEqual([
        "https://foo.bar/t/contribution/7",
      ]);
    });

    it("throws when post is not associated with this topic", () => {
      // Given
      const serverUrl = "https://foo.bar";
      const topic = exampleTopic();
      const firstPost = examplePost({topicId: 15});
      const parser = givenParseError("SHOULD_NOT_BE_CALLED");

      // When
      const fn = () =>
        initiativeFromDiscourseTracker(serverUrl, topic, firstPost, parser);

      // Then
      expect(fn).toThrow(
        'Post 432 is from a different topic for initiative topic "Example initiative" https://foo.bar/t/123'
      );
    });

    it("throws when post is not the first in topic", () => {
      // Given
      const serverUrl = "https://foo.bar";
      const topic = exampleTopic();
      const firstPost = examplePost({indexWithinTopic: 5});
      const parser = givenParseError("SHOULD_NOT_BE_CALLED");

      // When
      const fn = () =>
        initiativeFromDiscourseTracker(serverUrl, topic, firstPost, parser);

      // Then
      expect(fn).toThrow(
        'Post 432 is not the first post in the topic for initiative topic "Example initiative" https://foo.bar/t/123'
      );
    });

    it("extends parse error message with the initiative that caused it", () => {
      // Given
      const serverUrl = "https://foo.bar";
      const topic = exampleTopic();
      const firstPost = examplePost();
      const parser = givenParseError("BASE_ERROR_MESSAGE");

      // When
      const fn = () =>
        initiativeFromDiscourseTracker(serverUrl, topic, firstPost, parser);

      // Then
      expect(fn).toThrow(
        'BASE_ERROR_MESSAGE for initiative topic "Example initiative" https://foo.bar/t/123'
      );
    });
  });
});
