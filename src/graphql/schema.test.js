// @flow

import * as Schema from "./schema";

describe("graphql/schema", () => {
  function buildGithubTypes(): {[Schema.Typename]: Schema.NodeType} {
    const s = Schema;
    return {
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
    };
  }
  function buildGithubSchema(): Schema.Schema {
    return Schema.schema(buildGithubTypes());
  }

  describe("schema", () => {
    it("builds a representative schema", () => {
      const githubSchema = buildGithubSchema();
      expect(typeof githubSchema).toBe("object");
    });
    it("is deep-equal to but deep-distinct from its input", () => {
      const githubTypes = buildGithubTypes();
      const schema = Schema.schema(githubTypes);
      expect(githubTypes).toEqual(schema);
      expect(githubTypes).not.toBe(schema);
      expect(githubTypes.Repository).not.toBe(schema.Repository);
      {
        const a = githubTypes.Repository;
        const b = schema.Repository;
        if (a.type !== "OBJECT") throw new Error("githubTypes: " + a.type);
        if (b.type !== "OBJECT") throw new Error("schema: " + b.type);
        expect(a.fields).not.toBe(b.fields);
      }
      {
        const a = githubTypes.Actor;
        const b = schema.Actor;
        if (a.type !== "UNION") throw new Error("githubTypes: " + a.type);
        if (b.type !== "UNION") throw new Error("schema: " + b.type);
        expect(a.clauses).not.toBe(b.clauses);
      }
    });
    it("passes through serialization unscathed", () => {
      const schema = buildGithubSchema();
      expect(JSON.parse(JSON.stringify(schema))).toEqual(schema);
    });
    it("disallows unions with unknown clauses", () => {
      const s = Schema;
      const types = {
        U: s.union(["Wat"]),
      };
      expect(() => Schema.schema(types)).toThrowError(
        'union has unknown clause: "U"/"Wat"'
      );
    });
    it("disallows unions with non-object clauses", () => {
      const s = Schema;
      const types = {
        O: s.object({id: s.id()}),
        U1: s.union(["O"]),
        U2: s.union(["U1"]),
      };
      expect(() => Schema.schema(types)).toThrowError(
        'union has non-object type clause: "U2"/"U1"'
      );
    });
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
