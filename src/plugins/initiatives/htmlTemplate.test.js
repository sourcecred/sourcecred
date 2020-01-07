// @flow

import {groupURLsByHeader, parseCookedHtml} from "./htmlTemplate";

describe("plugins/initiatives/htmlTemplate", () => {
  describe("parseCookedHtml", () => {
    const sampleStatusIncomplete = `<h2>Status: Testing</h2>`;
    const sampleStatusComplete = `<h2>Status: Completed</h2>`;
    const sampleChampion = `
      <h2>Champion<a href="https://foo.bar/t/dont-include/10"><sup>?</sup></a>:</h2>
      <p>
        <a class="mention" href="/u/ChampUser">@ChampUser</a>
      </p>
    `;
    const sampleDependencies = `
        <h2>Dependencies:</h2>
        <ul>
          <li><a href="https://foo.bar/t/dependency/1">Thing we need</a></li>
          <li><a href="https://foo.bar/t/dependency/2">Thing we need</a></li>
          <li><a href="https://foo.bar/t/dependency/3">Thing we need</a></li>
        </ul>
    `;
    const sampleReferences = `
        <h2>References:</h2>
        <ul>
          <li><a href="https://foo.bar/t/reference/4">Some reference</a></li>
          <li><a href="https://foo.bar/t/reference/5/2">Some reference</a></li>
          <li><a href="https://foo.bar/t/reference/6/4">Some reference</a></li>
        </ul>
    `;
    const sampleContributions = `
        <h2>Contributions:</h2>
        <ul>
          <li><a href="https://foo.bar/t/contribution/7">Some contribution</a></li>
          <li><a href="https://foo.bar/t/contribution/8/2">Some contribution</a></li>
          <li><a href="https://github.com/sourcecred/sourcecred/pull/1416">Some contribution</a></li>
        </ul>
    `;

    it("handles an example text", () => {
      // Given
      const sample = `
        ${sampleStatusIncomplete}
        ${sampleChampion}
        ${sampleDependencies}
        ${sampleReferences}
        ${sampleContributions}
      `;

      // When
      const partial = parseCookedHtml(sample);

      // Then
      expect(partial).toMatchInlineSnapshot(`
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
        }
      `);
    });

    it("considers blank status incomplete", () => {
      // Given
      const sample = `
        <h1>Example initiative</h1>
        <h2>Status:</h2>
        <h2>Champion:</h2>
        <h2>Dependencies:</h2>
        <h2>References:</h2>
        <h2>Contributions:</h2>
      `;

      // When
      const partial = parseCookedHtml(sample);

      // Then
      expect(partial.completed).toEqual(false);
    });

    it("throws for missing all headers", () => {
      // Given
      const sample = `
        <h1>Example initiative</h1>
      `;

      // When
      const fn = () => parseCookedHtml(sample);

      // Then
      expect(fn).toThrow(
        `Missing or malformed headers ["champions","contributions","dependencies","references","status"]`
      );
    });

    it("throws for missing status header", () => {
      // Given
      const sample = `
        
        ${sampleChampion}
        ${sampleDependencies}
        ${sampleReferences}
        ${sampleContributions}
      `;

      // When
      const fn = () => parseCookedHtml(sample);

      // Then
      expect(fn).toThrow(`Missing or malformed headers ["status"]`);
    });

    it("throws for missing champions header", () => {
      // Given
      const sample = `
        ${sampleStatusIncomplete}
        
        ${sampleDependencies}
        ${sampleReferences}
        ${sampleContributions}
      `;

      // When
      const fn = () => parseCookedHtml(sample);

      // Then
      expect(fn).toThrow(`Missing or malformed headers ["champions"]`);
    });

    it("throws for missing dependencies header", () => {
      // Given
      const sample = `
        ${sampleStatusIncomplete}
        ${sampleChampion}
        
        ${sampleReferences}
        ${sampleContributions}
      `;

      // When
      const fn = () => parseCookedHtml(sample);

      // Then
      expect(fn).toThrow(`Missing or malformed headers ["dependencies"]`);
    });

    it("throws for missing references header", () => {
      // Given
      const sample = `
        ${sampleStatusIncomplete}
        ${sampleChampion}
        ${sampleDependencies}
        
        ${sampleContributions}
      `;

      // When
      const fn = () => parseCookedHtml(sample);

      // Then
      expect(fn).toThrow(`Missing or malformed headers ["references"]`);
    });

    it("throws for missing contributions header", () => {
      // Given
      const sample = `
        ${sampleStatusIncomplete}
        ${sampleChampion}
        ${sampleDependencies}
        ${sampleReferences}
        
      `;

      // When
      const fn = () => parseCookedHtml(sample);

      // Then
      expect(fn).toThrow(`Missing or malformed headers ["contributions"]`);
    });

    it("throws for conflicting status headers", () => {
      // Given
      const sample = `
        ${sampleStatusIncomplete}
        ${sampleStatusComplete}
        ${sampleChampion}
        ${sampleDependencies}
        ${sampleReferences}
        ${sampleContributions}
      `;

      // When
      const fn = () => parseCookedHtml(sample);

      // Then
      expect(fn).toThrow(`Missing or malformed headers ["status"]`);
    });

    it("throws for duplicate headers", () => {
      // Given
      const sample = `
        ${sampleStatusIncomplete}
        ${sampleChampion}
        ${sampleDependencies}
        ${sampleDependencies}
        ${sampleReferences}
        ${sampleContributions}
      `;

      // When
      const fn = () => parseCookedHtml(sample);

      // Then
      expect(fn).toThrow(`Unsupported duplicate header "Dependencies:" found`);
    });
  });

  describe("groupURLsByHeader", () => {
    it("handles an example text", () => {
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
      const map = groupURLsByHeader(sample);

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

    it("throws for duplicate headers", () => {
      // Given
      const sample = `
        <h1>This is a title</h1>
        <h1>This is a title</h1>
      `;

      // When
      const fn = () => groupURLsByHeader(sample);

      // Then
      expect(fn).toThrow(
        `Unsupported duplicate header "This is a title" found`
      );
    });
  });
});
