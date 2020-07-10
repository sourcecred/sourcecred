// @flow

import {fromString} from "./pluginId";

describe("api/pluginId", () => {
  function fail(s, msg) {
    expect(() => fromString(s)).toThrowError(msg);
  }
  it("accepts a valid PluginId", () => {
    expect(fromString("sourcecred/github")).toEqual("sourcecred/github");
  });
  it("lower-cases the PluginId", () => {
    expect(fromString("SourceCred/GitHub")).toEqual("sourcecred/github");
  });
  it("rejects invalid owner", () => {
    fail("foo bar/baz", `plugin owner not valid: "foo bar"`);
  });
  it("rejects invalid name", () => {
    fail("foo/bar baz", `plugin name not valid: "bar baz"`);
  });
  it("rejects empty owner", () => {
    fail("/baz", `plugin owner not valid: ""`);
  });
  it("rejects empty name", () => {
    fail("foo/", `plugin name not valid: ""`);
  });
  it("rejects string without a separator", () => {
    fail("foom", `PluginId must have exactly one "/" separator; got "foom"`);
  });
  it("rejects string without too many separators", () => {
    fail(
      "foom/bar/baz",
      `PluginId must have exactly one "/" separator; got "foom/bar/baz"`
    );
  });
});
