// @flow

import {JsonLog} from "./jsonLog";
import * as C from "./combo";
import dedent from "./dedent";

describe("util/jsonLog", () => {
  it("initializes to an empty log", () => {
    const l = new JsonLog();
    expect(Array.from(l.values())).toHaveLength(0);
  });
  it("can append values to log", () => {
    const l = new JsonLog<number>().append(1).append(2).append(3);
    expect(Array.from(l.values())).toEqual([1, 2, 3]);
  });
  it("can extend sequences into log", () => {
    const l = new JsonLog<number>().extend([1, 2]).extend([3]);
    expect(Array.from(l.values())).toEqual([1, 2, 3]);
  });
  it("values has the same iteration semantics as the underlying array", () => {
    const log = new JsonLog().extend([1, 2]);
    const arr = [1, 2];
    const logValues = log.values();
    const arrValues = arr.values();
    log.append(3);
    arr.push(3);
    expect(Array.from(logValues)).toEqual([1, 2, 3]);
    expect(Array.from(arrValues)).toEqual([1, 2, 3]);
  });

  it("converts empty log to empty file", () => {
    const emptyLogString = new JsonLog().toString();
    expect(emptyLogString).toEqual("");
  });
  it("parses an empty string as an empty log", () => {
    expect(JsonLog.fromString("", C.number)).toEqual(new JsonLog());
  });
  it("parses an empty array as an empty log", () => {
    expect(JsonLog.fromString("[]", C.number)).toEqual(new JsonLog());
  });

  it("converts logs to a json representation with each item on its own line", () => {
    const s = new JsonLog().extend([{name: "foo"}, {name: "bar"}]).toString();
    expect(s).toMatchInlineSnapshot(`
      "{\\"name\\":\\"foo\\"}
      {\\"name\\":\\"bar\\"}
      "
    `);
  });
  it("outputs valid json", () => {
    const items = [{name: "foo"}, {name: "bar"}];
    const s = new JsonLog().extend(items).toString();
    const lines = s.split("\n");
    expect(lines).toHaveLength(3);
    expect(JSON.parse(lines[0])).toEqual(items[0]);
    expect(JSON.parse(lines[1])).toEqual(items[1]);
    expect(lines[2]).toEqual("");
  });
  describe("fromString", () => {
    it("round-trips after toString", () => {
      const parser = C.object({foo: C.number});
      const ts = [{foo: 1}, {foo: 2}, {foo: 3}];
      const logString = new JsonLog().extend(ts).toString();
      const log = JsonLog.fromString(logString, parser);
      const items = Array.from(log.values());
      expect(items).toEqual(ts);
    });
    it("it parses the legacy form of non-empty data", () => {
      const parser = C.object({foo: C.number});
      const ts = [{foo: 1}, {foo: 2}, {foo: 3}];
      const oldFormat = dedent`\
        [
        {"foo":1}
        {"foo":2}
        {"foo":3}
        ]`; // no trailing newline
      const log = JsonLog.fromString(oldFormat, parser);
      const items = Array.from(log.values());
      expect(items).toEqual(ts);
    });
    it("it parses the legacy form of non-empty data with trailing LF", () => {
      const parser = C.object({foo: C.number});
      const ts = [{foo: 1}, {foo: 2}, {foo: 3}];
      const oldFormat = dedent`\
        [
        {"foo":1}
        {"foo":2}
        {"foo":3}
        ]
      `;
      const log = JsonLog.fromString(oldFormat, parser);
      const items = Array.from(log.values());
      expect(items).toEqual(ts);
    });
    it("it parses the legacy form of empty data", () => {
      const parser = C.object({foo: C.number});
      const ts = [];
      const oldFormat = "[]"; // no trailing newline
      const log = JsonLog.fromString(oldFormat, parser);
      const items = Array.from(log.values());
      expect(items).toEqual(ts);
    });
    it("has a friendly error for invalid JSON", () => {
      const parser = C.object({foo: C.number});
      const serialized = '{"foo":1}\nwat\n';
      expect(() => void JsonLog.fromString(serialized, parser)).toThrow(
        /line 2.*Unexpected token w/
      );
    });
    it("has a friendly error for sub-parser errors", () => {
      const parser = C.fmap(C.raw, (x) => {
        if (x !== 777) {
          throw new Error("get out of here");
        }
        return x;
      });
      const serialized = "777\n666\n";
      expect(() => void JsonLog.fromString(serialized, parser)).toThrow(
        "line 2: get out of here"
      );
    });
  });
});
