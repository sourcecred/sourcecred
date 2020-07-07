// @flow

import {JsonLog} from "./jsonLog";
import * as C from "./combo";
import tmp from "tmp";

describe("util/jsonLog", () => {
  it("initializes to an empty log", () => {
    const l = new JsonLog();
    expect(Array.from(l.values())).toHaveLength(0);
  });
  it("can append values to log", () => {
    const l = new JsonLog().append([1, 2]).append([3]);
    expect(Array.from(l.values())).toEqual([1, 2, 3]);
  });
  it("values has the same iteration semantics as the underlying array", () => {
    const log = new JsonLog().append([1, 2]);
    const arr = [1, 2];
    const logValues = log.values();
    const arrValues = arr.values();
    log.append([3]);
    arr.push(3);
    expect(Array.from(logValues)).toEqual([1, 2, 3]);
    expect(Array.from(arrValues)).toEqual([1, 2, 3]);
  });

  it("converts empty log to empty string", () => {
    expect(new JsonLog().toString()).toEqual("");
  });
  it("parses an empty string as an empty log", () => {
    expect(JsonLog.fromString("", C.number)).toEqual(new JsonLog());
  });
  it("parses a string with just a comment as an empty log", () => {
    expect(JsonLog.fromString("// Example Comment", C.number)).toEqual(
      new JsonLog()
    );
  });
  it("parses a log with comments", () => {
    expect(JsonLog.fromString(`// Example Comment\n3\n`, C.number)).toEqual(
      new JsonLog().append([3])
    );
  });

  it("converts logs to a string representation with each item on its own line", () => {
    const s = new JsonLog().append([{name: "foo"}, {name: "bar"}]).toString();
    expect(s).toMatchInlineSnapshot(`
      "{\\"name\\":\\"foo\\"}
      {\\"name\\":\\"bar\\"}"
    `);
  });
  it("parses from the serialized format correctly", () => {
    const parser = C.object({foo: C.number});
    const ts = [{foo: 1}, {foo: 2}, {foo: 3}];
    const logString = new JsonLog().append(ts).toString();
    const log = JsonLog.fromString(logString, parser);
    const items = Array.from(log.values());
    expect(items).toEqual(ts);
  });

  it("writes and reads to a log file correctly", async () => {
    const fname = tmp.tmpNameSync();
    const log = new JsonLog().append([1, 2, 3]);
    await log.writeJsonLog(fname);
    const log2 = await JsonLog.readJsonLog(fname, C.number);
    expect(log).toEqual(log2);
  });
});
