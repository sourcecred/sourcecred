// @flow

import {groupURLsByHeader, initiativeFromDiscourseTracker} from "./discourse";
import {NodeAddress} from "../../core/graph";

function exampleTopic(overrides: ?Object) {
  return {
    id: 123,
    categoryId: 42,
    title: "Example initiative",
    timestampMs: 1571498171951,
    authorUsername: "TestUser",
    ...overrides,
  };
}

function examplePost(cooked) {
  return {
    id: 432,
    topicId: 123,
    indexWithinTopic: 1,
    replyToPostIndex: null,
    timestampMs: 1571498171951,
    authorUsername: "TestUser",
    cooked,
  };
}

function nonBinaryInitiative(object) {
  return {
    ...object,
    tracker: NodeAddress.toParts(object.tracker),
  };
}

describe("plugins/initiatives/discourse", () => {
  describe("initiativeFromDiscourseTracker", () => {
    it("handles an example tracker", async () => {
      // Given
      const serverUrl = "https://foo.bar";
      const topic = exampleTopic();
      const firstPost = examplePost(`
        <h1>Example initiative</h1>
        <h2>Status: Testing</h2>
        <h2>Champion<a href="https://foo.bar/t/dont-include/10"><sup>?</sup></a>:</h2>
        <p>
          <a class="mention" href="/u/ChampUser">@ChampUser</a>
        </p>
        <h2>Dependencies:</h2>
        <ul>
          <li><a href="https://foo.bar/t/dependency/1">Thing we need</a></li>
          <li><a href="https://foo.bar/t/dependency/2">Thing we need</a></li>
          <li><a href="https://foo.bar/t/dependency/3">Thing we need</a></li>
        </ul>
        <h2>References:</h2>
        <ul>
          <li><a href="https://foo.bar/t/reference/4">Some reference</a></li>
          <li><a href="https://foo.bar/t/reference/5/2">Some reference</a></li>
          <li><a href="https://foo.bar/t/reference/6/4">Some reference</a></li>
        </ul>
        <h2>Contributions:</h2>
        <ul>
          <li><a href="https://foo.bar/t/contribution/7">Some contribution</a></li>
          <li><a href="https://foo.bar/t/contribution/8/2">Some contribution</a></li>
          <li><a href="https://github.com/sourcecred/sourcecred/pull/1416">Some contribution</a></li>
        </ul>
      `);

      // When
      const initiative = await initiativeFromDiscourseTracker(
        serverUrl,
        topic,
        firstPost
      );

      // Then
      expect(initiative.completed).toEqual(false);
      expect(nonBinaryInitiative(initiative)).toMatchInlineSnapshot(`
        Object {
          "champions": Array [
            "/u/ChampUser",
          ],
          "completed": false,
          "contributions": Array [
            "https://foo.bar/t/contribution/7",
            "https://foo.bar/t/contribution/8/2",
            "https://github.com/sourcecred/sourcecred/pull/1416",
          ],
          "dependencies": Array [
            "https://foo.bar/t/dependency/1",
            "https://foo.bar/t/dependency/2",
            "https://foo.bar/t/dependency/3",
          ],
          "references": Array [
            "https://foo.bar/t/reference/4",
            "https://foo.bar/t/reference/5/2",
            "https://foo.bar/t/reference/6/4",
          ],
          "timestampMs": 1571498171951,
          "title": "Example initiative",
          "tracker": Array [
            "sourcecred",
            "discourse",
            "topic",
            "https://foo.bar",
            "123",
          ],
        }
      `);
    });

    it("handles a completed status", async () => {
      // Given
      const serverUrl = "https://foo.bar";
      const topic = exampleTopic();
      const firstPost = examplePost(`
        <h1>Example initiative</h1>
        <h2>Status: Complete</h2>
        <h2>Champion:</h2>
        <h2>Dependencies:</h2>
        <h2>References:</h2>
        <h2>Contributions:</h2>
      `);

      // When
      const initiative = await initiativeFromDiscourseTracker(
        serverUrl,
        topic,
        firstPost
      );

      // Then
      expect(initiative.completed).toEqual(true);
      expect(nonBinaryInitiative(initiative)).toMatchInlineSnapshot(`
        Object {
          "champions": Array [],
          "completed": true,
          "contributions": Array [],
          "dependencies": Array [],
          "references": Array [],
          "timestampMs": 1571498171951,
          "title": "Example initiative",
          "tracker": Array [
            "sourcecred",
            "discourse",
            "topic",
            "https://foo.bar",
            "123",
          ],
        }
      `);
    });

    it("considers blank status incomplete", async () => {
      // Given
      const serverUrl = "https://foo.bar";
      const topic = exampleTopic();
      const firstPost = examplePost(`
        <h1>Example initiative</h1>
        <h2>Status:</h2>
        <h2>Champion:</h2>
        <h2>Dependencies:</h2>
        <h2>References:</h2>
        <h2>Contributions:</h2>
      `);

      // When
      const initiative = await initiativeFromDiscourseTracker(
        serverUrl,
        topic,
        firstPost
      );

      // Then
      expect(initiative.completed).toEqual(false);
    });

    it("crashes when missing headers", async () => {
      // Given
      const serverUrl = "https://foo.bar";
      const topic = exampleTopic();
      const firstPost = examplePost(`<h1>Example initiative</h1>`);

      // When
      const initiativeP = initiativeFromDiscourseTracker(
        serverUrl,
        topic,
        firstPost
      );

      // Then
      await expect(initiativeP).rejects.toThrow(
        'Missing or malformed headers ["champions","contributions","dependencies","references","status"] for initiative topic "Example initiative" (123)'
      );
    });

    it("crashes on duplicate headers", async () => {
      // Given
      const serverUrl = "https://foo.bar";
      const topic = exampleTopic();
      const firstPost = examplePost(`
        <h1>Example initiative</h1>
        <h2>Status: Complete</h2>
        <h2>Champion:</h2>
        <h2>Champions:</h2>
        <h2>Dependencies:</h2>
        <h2>References:</h2>
        <h2>Contributions:</h2>
      `);

      // When
      const initiativeP = initiativeFromDiscourseTracker(
        serverUrl,
        topic,
        firstPost
      );

      // Then
      await expect(initiativeP).rejects.toThrow(
        'Missing or malformed headers ["champions"] for initiative topic "Example initiative" (123)'
      );
    });
  });

  describe("groupURLsByHeader", () => {
    it("handles an example text", async () => {
      // Given
      const sample = `
      <h1>This is a title</h1>
      <p>
        Things to talk about.
        <a href="https://foo.bar/1">With links</a>
      </p>
      <a href="https://foo.bar/baz">Seems unmarkdownly formatted</a>
      <h2>Some <i>funky</i> section:</h2>
      <p>
        <a href="https://foo.bar/2">With</a>
        <strong><a href="https://foo.bar/3">More</a></strong>
      </p>
      <p>
        <a href="https://foo.bar/4">Links</a>
      </p>
      <h2>Listed things<a href="https://foo.bar/t/dont-include/10"><sup>?</sup></a>:</h2>
      <ul>
        <li><a href="https://foo.bar/5">Yet</a></li>
        <li><a href="https://foo.bar/6">More</a></li>
        <li><a href="https://foo.bar/7">Links</a></li>
      </ul>
      <h2>Ordered things:</h2>
      <ol>
        <li><a href="https://foo.bar/8">Yet</a></li>
        <li><a href="https://foo.bar/9">More</a></li>
        <li><a href="https://foo.bar/10">Links</a></li>
      </ol>
      `;

      // When
      const map = await groupURLsByHeader(sample);

      // Then
      expect(map).toMatchInlineSnapshot(`
        Map {
          "This is a title" => Array [
            "https://foo.bar/1",
          ],
          "Some funky section:" => Array [
            "https://foo.bar/2",
            "https://foo.bar/3",
            "https://foo.bar/4",
          ],
          "Listed things?:" => Array [
            "https://foo.bar/5",
            "https://foo.bar/6",
            "https://foo.bar/7",
          ],
          "Ordered things:" => Array [
            "https://foo.bar/8",
            "https://foo.bar/9",
            "https://foo.bar/10",
          ],
        }
      `);
    });
  });
});
