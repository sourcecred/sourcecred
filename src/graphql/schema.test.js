// @flow

import * as Schema from "./schema";

describe("graphql/schema", () => {
  function buildGithubSchema(): Schema.Schema {
    const s = Schema;
    return s.schema({
      Repository: s.object({
        id: s.id(),
        url: s.primitive(),
        issues: s.connection("Issue"),
      }),
      Issue: s.object({
        id: s.id(),
        url: s.primitive(),
        author: s.node("Actor"),
        parent: s.node("Repository"),
        title: s.primitive(),
        comments: s.connection("IssueComment"),
      }),
      IssueComment: s.object({
        id: s.id(),
        body: s.primitive(),
        author: s.node("Actor"),
      }),
      Actor: s.union(["User", "Bot", "Organization"]), // actually an interface
      User: s.object({
        id: s.id(),
        url: s.primitive(),
        login: s.primitive(),
      }),
      Bot: s.object({
        id: s.id(),
        url: s.primitive(),
        login: s.primitive(),
      }),
      Organization: s.object({
        id: s.id(),
        url: s.primitive(),
        login: s.primitive(),
      }),
    });
  }

  it("builds a representative schema", () => {
    const githubSchema = buildGithubSchema();
    expect(typeof githubSchema).toBe("object");
  });
  it("passes through serialization unscathed", () => {
    const schema = buildGithubSchema();
    expect(JSON.parse(JSON.stringify(schema))).toEqual(schema);
  });

  describe("object", () => {
    const s = Schema;
    it('requires an "id" field', () => {
      expect(() => s.object({})).toThrow('expected ID field with name "id"');
    });
    it('requires field "id" to be an ID', () => {
      expect(() => s.object({id: s.primitive()})).toThrow(
        'field "id" must be an ID field'
      );
    });
    it("prohibits unexpected ID fields", () => {
      expect(() => s.object({id: s.id(), di: s.id()})).toThrow(
        'invalid ID field with name "di"'
      );
    });
    it("prohibits a field called __typename", () => {
      expect(() => s.object({id: s.id(), __typename: s.primitive()})).toThrow(
        "reserved field name: __typename"
      );
    });
    it("builds reasonable objects", () => {
      const o1 = s.object({id: s.id()});
      const o2 = s.object({
        id: s.id(),
        name: s.primitive(),
        widget: s.node("Widget"),
        mcguffins: s.connection("McGuffin"),
      });
      expect(o1).not.toEqual(o2);
    });
    it("is invariant with respect to field order", () => {
      const o1 = s.object({id: s.id(), x: s.primitive(), y: s.node("Y")});
      const o2 = s.object({y: s.node("Y"), x: s.primitive(), id: s.id()});
      expect(o1).toEqual(o2);
    });
  });

  describe("union", () => {
    const s = Schema;
    it("permits the empty union", () => {
      s.union([]);
    });
    it("forbids duplicate clauses", () => {
      expect(() => s.union(["One", "One"])).toThrow(
        'duplicate union clause: "One"'
      );
    });
    it("builds reasonable unions", () => {
      const u1 = s.union(["A", "B"]);
      const u2 = s.union(["B", "C"]);
      expect(u1).not.toEqual(u2);
    });
    it("is invariant with respect to clause order", () => {
      expect(s.union(["One", "Two"])).toEqual(s.union(["Two", "One"]));
    });
  });
});
