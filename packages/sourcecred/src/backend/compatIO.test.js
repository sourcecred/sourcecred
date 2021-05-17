// @flow

import tmp from "tmp";
import path from "path";
import fs from "fs-extra";
import {type Compatible, toCompat, fromCompat} from "../util/compat";
import {Graph} from "../core/graph";
import * as WeightedGraph from "../core/weightedGraph";
import {node as graphNode} from "../core/graphTestUtil";
import {compatWriter, compatReader} from "./compatIO";

type MockDataType = {+[string]: string};

const mockCompatInfo = {type: "mock", version: "1"};

function mockToJSON(x: MockDataType): Compatible<MockDataType> {
  return toCompat(mockCompatInfo, x);
}

function mockFromJSON(x: Compatible<any>): MockDataType {
  return fromCompat(mockCompatInfo, x);
}

describe("src/backend/compatIO", () => {
  describe("compatWriter", () => {
    it("should work with example type", async () => {
      // Given
      const filePath = path.join(tmp.dirSync().name, "mockData.json");
      const data: MockDataType = {foo: "bar"};

      // When
      const writer = compatWriter(mockToJSON);
      await writer(filePath, data);

      // Then
      const actualData = await fs.readFile(filePath, "utf8");
      expect(actualData).toEqual(
        `[{"type":"mock","version":"1"},{"foo":"bar"}]`
      );
    });

    it("should handle write errors", async () => {
      // Given
      const filePath = tmp.dirSync().name;
      const data: MockDataType = {foo: "bar"};

      // When
      const writer = compatWriter(mockToJSON);
      const p = writer(filePath, data);

      // Then
      await expect(p).rejects.toThrow("Could not write data:\nError: EISDIR");
    });

    it("should accept a typeName to improve errors", async () => {
      // Given
      const filePath = tmp.dirSync().name;
      const data: MockDataType = {foo: "bar"};
      const name = "TestName";

      // When
      const writer = compatWriter(mockToJSON, name);
      const p = writer(filePath, data);

      // Then
      await expect(p).rejects.toThrow(
        `Could not write ${name} data:\nError: EISDIR`
      );
    });

    it("should use stable json serialization", async () => {
      // Given
      const filePath = path.join(tmp.dirSync().name, "mockData.json");
      const data: MockDataType = {bbb: "second", aaa: "first"};

      // When
      const writer = compatWriter(mockToJSON);
      await writer(filePath, data);

      // Then
      const actualData = (await fs.readFile(filePath)).toString("utf-8");
      expect(actualData).toEqual(
        `[{"type":"mock","version":"1"},{"aaa":"first","bbb":"second"}]`
      );
    });
  });

  describe("compatReader", () => {
    it("should work with example type", async () => {
      // Given
      const filePath = path.join(tmp.dirSync().name, "mockData.json");
      const fileContents = `[{"type":"mock","version":"1"},{"foo":"bar"}]`;
      await fs.writeFile(filePath, fileContents);

      // When
      const reader = compatReader(mockFromJSON);
      const data = await reader(filePath);

      // Then
      expect(data).toEqual({foo: "bar"});
    });

    it("should check the file exists", async () => {
      // Given
      const filePath = path.join(tmp.dirSync().name, "mockData.json");

      // When
      const reader = compatReader(mockFromJSON);
      const p = reader(filePath);

      // Then
      await expect(p).rejects.toThrow("Could not find file at:");
    });

    it("should check for invalid file content", async () => {
      // Given
      const filePath = path.join(tmp.dirSync().name, "mockData.json");
      await fs.writeFile(filePath, "-not valid JSON-");

      // When
      const reader = compatReader(mockFromJSON);
      const p = reader(filePath);

      // Then
      await expect(p).rejects.toThrow(
        "Provided file is invalid:\nSyntaxError: Unexpected token"
      );
    });

    it("should check for invalid compat type", async () => {
      // Given
      const filePath = path.join(tmp.dirSync().name, "mockData.json");
      const fileContents = `[{"type":"wrong-type","version":"1"},{"foo":"bar"}]`;
      await fs.writeFile(filePath, fileContents);

      // When
      const reader = compatReader(mockFromJSON);
      const p = reader(filePath);

      // Then
      await expect(p).rejects.toThrow(
        "Provided file is invalid:\nError: Expected type to be mock but got wrong-type"
      );
    });

    it("should check for invalid compat version", async () => {
      // Given
      const filePath = path.join(tmp.dirSync().name, "mockData.json");
      const fileContents = `[{"type":"mock","version":"2"},{"foo":"bar"}]`;
      await fs.writeFile(filePath, fileContents);

      // When
      const reader = compatReader(mockFromJSON);
      const p = reader(filePath);

      // Then
      await expect(p).rejects.toThrow(
        "Provided file is invalid:\nError: mock: tried to load unsupported version 2"
      );
    });

    it("should accept a typeName to improve errors", async () => {
      // Given
      const filePath = path.join(tmp.dirSync().name, "mockData.json");
      const name = "TestName";

      // When
      const reader = compatReader(mockFromJSON, name);
      const p = reader(filePath);

      // Then
      await expect(p).rejects.toThrow(`Could not find ${name} file at:`);
    });
  });

  describe("compatReader + compatWriter", () => {
    it("should work as a round-trip", async () => {
      // Given
      const filePath = path.join(tmp.dirSync().name, "mockData.json");
      const data: MockDataType = {foo: "bar"};

      // When
      const writer = compatWriter(mockToJSON);
      const reader = compatReader(mockFromJSON);
      await writer(filePath, data);
      const actualData = await reader(filePath);

      // Then
      expect(actualData).toEqual(data);
    });

    // Note: this is a smoke test and can be safely removed if needed.
    it("should work with Graph Compatible type", async () => {
      // Given
      const filePath = path.join(tmp.dirSync().name, "graph.json");
      const graph = new Graph();
      graph.addNode(graphNode("example-node"));

      // When
      const writer = compatWriter((g: Graph) => g.toJSON());
      const reader = compatReader(Graph.fromJSON);
      await writer(filePath, graph);
      const actual = await reader(filePath);

      // Then
      expect(actual.equals(graph)).toBe(true);
    });

    // Note: this is a smoke test and can be safely removed if needed.
    it("should work with WeightedGraph Compatible type", async () => {
      // Given
      const filePath = path.join(tmp.dirSync().name, "weightedGraph.json");
      const wg = WeightedGraph.empty();
      wg.graph.addNode(graphNode("example-node"));

      // When
      const writer = compatWriter(WeightedGraph.toJSON);
      const reader = compatReader(WeightedGraph.fromJSON);
      await writer(filePath, wg);
      const actual = await reader(filePath);

      // Then
      expect(actual.graph.equals(wg.graph)).toBe(true);
      expect(actual.weights).toEqual(wg.weights);
    });
  });
});
