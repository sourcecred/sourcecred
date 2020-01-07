// @flow

import {type HtmlTemplateInitiativePartial} from "./htmlTemplate";
import {
  initiativeFromDiscourseTracker,
  DiscourseInitiativeRepository,
  type DiscourseQueries,
} from "./discourse";
import {type Initiative} from "./initiative";
import type {Topic, Post, CategoryId, TopicId} from "../discourse/fetch";
import {NodeAddress} from "../../core/graph";
import dedent from "../../util/dedent";

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

function snapshotInitiative(initiative: Initiative): Object {
  return {
    ...initiative,
    tracker: NodeAddress.toParts(initiative.tracker),
  };
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

function exampleOptions({
  topics,
  initiativesCategory,
  topicBlacklist,
  parseCookedHtml,
}: any) {
  return {
    serverUrl: "https://foo.bar",
    topicBlacklist: topicBlacklist || [],
    initiativesCategory: initiativesCategory || 42,
    queries: new MockDiscourseQueries(topics || []),
    parseCookedHtml,
  };
}

type TopicWithOpeningPost = {|
  +topic: Topic,
  +post: Post,
|};

class MockDiscourseQueries implements DiscourseQueries {
  _entries: Map<TopicId, TopicWithOpeningPost>;

  constructor(topics: $Shape<Topic>[]) {
    this._entries = new Map();
    jest.spyOn(this, "topicsInCategories");
    jest.spyOn(this, "topicById");
    jest.spyOn(this, "postsInTopic");

    let postId = 100;
    for (const topicShape of topics) {
      const topic = exampleTopic(topicShape);
      const post = examplePost({
        id: postId++,
        topicId: topic.id,
      });
      this._entries.set(topic.id, {topic, post});
    }
  }

  topicsInCategories(
    categoryIds: $ReadOnlyArray<CategoryId>
  ): $ReadOnlyArray<TopicId> {
    const ids: TopicId[] = [];
    for (const {topic} of this._entries.values()) {
      if (categoryIds.includes(topic.categoryId)) {
        ids.push(topic.id);
      }
    }
    return ids;
  }

  topicById(id: TopicId): ?Topic {
    const pair = this._entries.get(id);
    return pair ? pair.topic : null;
  }

  postsInTopic(topicId: TopicId, numberOfPosts: number): $ReadOnlyArray<Post> {
    if (numberOfPosts != 1) {
      throw new Error(
        "MockDiscourseQueries doesn't support anything but 1 for numberOfPosts"
      );
    }

    const pair = this._entries.get(topicId);
    return pair ? [pair.post] : [];
  }
}

describe("plugins/initiatives/discourse", () => {
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

  describe("DiscourseInitiativeRepository", () => {
    it("uses topicsInCategories to find initiative topics", () => {
      // Given
      const options = exampleOptions({
        initiativesCategory: 16,
        parseCookedHtml: givenParseResponse(examplePartialIniative()),
      });

      // When
      const repo = new DiscourseInitiativeRepository(options);
      repo.initiatives();

      // Then
      expect(options.queries.topicsInCategories).toBeCalledTimes(1);
      expect(options.queries.topicsInCategories).toBeCalledWith([16]);
    });

    it("attempts to get Topic and opening Post for each TopicId found", () => {
      // Given
      const options = exampleOptions({
        topics: [{id: 40}, {id: 41}, {id: 42}],
        parseCookedHtml: givenParseResponse(examplePartialIniative()),
      });

      // When
      const repo = new DiscourseInitiativeRepository(options);
      repo.initiatives();

      // Then
      expect(options.queries.topicById).toBeCalledTimes(3);
      expect(options.queries.topicById).toBeCalledWith(40);
      expect(options.queries.topicById).toBeCalledWith(41);
      expect(options.queries.topicById).toBeCalledWith(42);
      expect(options.queries.postsInTopic).toBeCalledTimes(3);
      expect(options.queries.postsInTopic).toBeCalledWith(40, 1);
      expect(options.queries.postsInTopic).toBeCalledWith(41, 1);
      expect(options.queries.postsInTopic).toBeCalledWith(42, 1);
    });

    it("filters blacklisted Topics from TopicId found", () => {
      // Given
      const options = exampleOptions({
        topicBlacklist: [41, 50],
        topics: [{id: 40}, {id: 41}, {id: 42}],
        parseCookedHtml: givenParseResponse(examplePartialIniative()),
      });

      // When
      const repo = new DiscourseInitiativeRepository(options);
      repo.initiatives();

      // Then
      expect(options.queries.topicById).toBeCalledTimes(2);
      expect(options.queries.topicById).toBeCalledWith(40);
      expect(options.queries.topicById).toBeCalledWith(42);
      expect(options.queries.postsInTopic).toBeCalledTimes(2);
      expect(options.queries.postsInTopic).toBeCalledWith(40, 1);
      expect(options.queries.postsInTopic).toBeCalledWith(42, 1);
    });

    it("creates Initiatives for matched Topics", () => {
      // Given
      const options = exampleOptions({
        topics: [{id: 40}, {id: 42}],
        parseCookedHtml: givenParseResponse(
          examplePartialIniative({
            references: ["https://example.org/references/included"],
          })
        ),
      });

      // When
      const repo = new DiscourseInitiativeRepository(options);
      const initiatives = repo.initiatives();

      // Then
      expect(initiatives.map(snapshotInitiative)).toMatchInlineSnapshot(`
        Array [
          Object {
            "champions": Array [],
            "completed": false,
            "contributions": Array [],
            "dependencies": Array [],
            "references": Array [
              "https://example.org/references/included",
            ],
            "timestampMs": 1571498171951,
            "title": "Example initiative",
            "tracker": Array [
              "sourcecred",
              "discourse",
              "topic",
              "https://foo.bar",
              "40",
            ],
          },
          Object {
            "champions": Array [],
            "completed": false,
            "contributions": Array [],
            "dependencies": Array [],
            "references": Array [
              "https://example.org/references/included",
            ],
            "timestampMs": 1571498171951,
            "title": "Example initiative",
            "tracker": Array [
              "sourcecred",
              "discourse",
              "topic",
              "https://foo.bar",
              "42",
            ],
          },
        ]
      `);
    });

    it("warns when Initiatives fail to parse", () => {
      // Given
      const options = exampleOptions({
        topics: [{id: 40}, {id: 42}],
        parseCookedHtml: givenParseError("Testing parse error"),
      });

      // When
      const repo = new DiscourseInitiativeRepository(options);
      const initiatives = repo.initiatives();

      // Then
      expect(initiatives).toEqual([]);
      expect(console.warn).toHaveBeenCalledWith(
        dedent`
        Failed loading [2/2] initiatives:
        Testing parse error for initiative topic "Example initiative" https://foo.bar/t/40
        Testing parse error for initiative topic "Example initiative" https://foo.bar/t/42
      `.trim()
      );
      expect(console.warn).toHaveBeenCalledTimes(1);
      spyWarn().mockReset();
    });
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
