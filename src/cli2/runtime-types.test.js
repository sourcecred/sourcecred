// @flow

import tcomb from "tcomb";
import * as iots from "io-ts";
import {PathReporter} from "io-ts/lib/PathReporter";
import {fold, left} from "fp-ts/lib/Either";
import tcombFromJSON from "tcomb/lib/fromJSON";
import fr, {type Type as FlowRuntimeType} from "flow-runtime";
import {
  type RepoId,
  type RepoIdString,
  githubOwnerPattern,
  githubRepoPattern,
  stringToRepoId,
  repoIdToString,
} from "../plugins/github/repoId";

describe("src/cli2/runtime-types", () => {
  type JsonObject =
    | string
    | number
    | boolean
    | null
    | JsonObject[]
    | {[string]: JsonObject};

  type GitHubConfig = {|
    +repoIds: $ReadOnlyArray<RepoId>,
  |};

  type RawGitHubConfig = {|
    +repoIds: $ReadOnlyArray<string>,
  |};

  const RepoIdStringPattern = new RegExp(
    `^(${githubOwnerPattern})/(${githubRepoPattern})$`
  );

  describe("flow-runtime", () => {
    /*
      Pros:
      - These types could be generated with babel, or to a file with CLI.
      - Keeps with Flow terminology.

      Cons:
      - Only asserts, doesn't support mapping "foo/bar" to ["foo", "bar"].
      - Ironically, the library doesn't expose Flow types.
        https://github.com/gajus/flow-runtime/issues/243
    */

    const RepoIdStringType: FlowRuntimeType<RepoIdString> = fr.refinement(
      fr.string(),
      (s: string) => {
        if (!RepoIdStringPattern.test(s)) {
          return "must be in owner/repository format";
        }
      }
    );

    const GitHubConfigType: FlowRuntimeType<RawGitHubConfig> = fr.type(
      "GitHubConfig",
      fr.object({repoIds: fr.array(RepoIdStringType)})
    );

    it("should support static type checking of Type<T>", () => {
      // TODO: add ExpectFlowError when types are exported.

      // The method signature is, accepts(input: any): boolean
      // But no Flow types exposed by library, so this goes undetected.
      const _: string = GitHubConfigType.accepts("foo", "bar");
    });

    it("should parse an empty example", () => {
      const json: JsonObject = {repoIds: []};
      const config = GitHubConfigType.assert(json);
      expect(config).toEqual(json);
    });

    it("should allow valid RepoId strings", () => {
      const json: JsonObject = {repoIds: ["sourcecred/sourcecred", "foo/bar"]};
      const config = GitHubConfigType.assert(json);
      expect(config).toEqual(json);
    });

    it("should throw when RepoId strings don't match pattern", () => {
      const json: JsonObject = {repoIds: ["foo/bar", "not-a-repoId"]};
      const f = () => GitHubConfigType.assert(json);
      expect(f).toThrow(TypeError);
      expect(f).toThrow(
        "GitHubConfig.repoIds[1] must be in owner/repository format"
      );
    });
  });

  describe("tcomb", () => {
    /*
      Pros:
      - Has support for parsing, besides only asserting.

      Maybe:
      - Similarity to our existing toJSON/fromJSON approach.
      - fromJSON also includes default behavior which may be unexpected. Such as automatically parsing
        "2018-02-01T12:34:56.789Z" to a Date type because it will attempt using it's contructor.

      Cons:
      - No {key?: T} support, normalizes to {key: ?T}
      - Flow type based generation seems unmaintained / deprectated
        https://github.com/gcanti/babel-plugin-tcomb (fork recommends flow-runtime)
      - Library's Flow types published as a copy-paste declaration, are bugged and not helpful
        https://github.com/gcanti/pantarei/blob/master/tcomb/3.x.x-0.33.x/tcomb.js
    */

    const RepoIdType = tcomb.struct(
      {owner: tcomb.String, name: tcomb.String},
      {name: "RepoId", strict: true}
    );

    // Adds a custom "reviver" method to the type, which is used by "tcomb/lib/fromJSON".
    // https://github.com/gcanti/tcomb/blob/master/docs/API.md#the-libfromjson-module
    RepoIdType.fromJSON = stringToRepoId;

    // Also make sure we serialize it as string.
    RepoIdType.prototype.toJSON = function () {
      return repoIdToString(this);
    };

    const GitHubConfigType = tcomb.struct(
      {repoIds: tcomb.list(RepoIdType)},
      {name: "GitHubConfig", strict: true}
    );

    it("should parse an empty example", () => {
      const json: JsonObject = {repoIds: []};
      const config = tcombFromJSON(json, GitHubConfigType);
      expect(config).toEqual(json);
    });

    it("should parse valid RepoIdStrings", () => {
      const json: JsonObject = {repoIds: ["sourcecred/sourcecred", "foo/bar"]};
      const config = tcombFromJSON(json, GitHubConfigType);
      expect(config).toEqual({
        repoIds: [
          {owner: "sourcecred", name: "sourcecred"},
          {owner: "foo", name: "bar"},
        ],
      });
    });

    it("should serialize RepoIds back to strings", () => {
      const config: GitHubConfig = GitHubConfigType({
        repoIds: [
          {owner: "sourcecred", name: "sourcecred"},
          {owner: "foo", name: "bar"},
        ],
      });
      const json: JsonObject = JSON.parse(JSON.stringify(config));
      expect(json).toEqual({repoIds: ["sourcecred/sourcecred", "foo/bar"]});
    });

    it("should runtime validate fromJSON output", () => {
      // Declare the type again, so we don't polute it's fromJSON.
      const _GitHubConfigTypeAlt = tcomb.struct(
        {repoIds: tcomb.list(RepoIdType)},
        {name: "GitHubConfig", strict: true}
      );

      // Fake an invalid type slipped through we want to catch at runtime.
      _GitHubConfigTypeAlt.fromJSON = (raw: RawGitHubConfig) => ({
        ...raw,
        repoIds: raw.repoIds.map((_) => false),
      });

      const json: JsonObject = {repoIds: ["sourcecred/sourcecred", "foo/bar"]};
      const f = () => tcombFromJSON(json, _GitHubConfigTypeAlt);
      expect(f).toThrow(TypeError);
      expect(f).toThrow(
        "[tcomb] Invalid value false supplied to GitHubConfig/repoIds: Array<RepoId>/0: RepoId (expected an object)"
      );
    });

    it("should throw when RepoId strings don't match pattern", () => {
      const json: JsonObject = {repoIds: ["foo/bar", "not-a-repoId"]};
      const f = () => tcombFromJSON(json, GitHubConfigType);

      // Note: this is not a tcomb, but `stringToRepoId` error.
      expect(f).toThrow(Error);
      expect(f).toThrow("Invalid repo string: not-a-repoId");
    });

    it("should assert when using the type constructor", () => {
      const unvalidatedObject: any = {repoIds: [1, 2, 3]};
      const f = (): GitHubConfig => GitHubConfigType(unvalidatedObject);
      expect(f).toThrow(TypeError);
      expect(f).toThrow(
        "[tcomb] Invalid value 1 supplied to GitHubConfig/repoIds: Array<RepoId>/0: RepoId (expected an object)"
      );
    });

    it("should add keys for maybe types", () => {
      const T = tcomb.struct({
        foo: tcomb.maybe(tcomb.String),
      });
      const out = T({});
      expect(Object.keys(out)).toEqual(["foo"]);
    });
  });

  describe("io-ts", () => {
    /*
      Pros:
      - Has support for parsing, besides only asserting.

      Maybe:
      - Experimental schema concept.
      - FP-style safety rather than TypeError throwing assertions.

      Cons:
      - Flow types were dropped https://github.com/gcanti/io-ts/issues/145
      - Aims for TypeScript rather than Flow parity. (maybe can derive Flow types from TS?)
      - Has peer dependency `fp-ts`.
    */

    const identity = (x) => x;
    function throwingDecode<T>(raw: any, typedef: {decode: Function}): T {
      function decodeError(errors: Object[]) {
        // Reporter expect an either, wrap it back in a left().
        const errorString = PathReporter.report(left(errors)).join("\n\t");
        throw new TypeError(`Validation failed on decode:\n\t${errorString}`);
      }
      const assert = fold(decodeError, identity);
      return assert(typedef.decode(raw));
    }

    const RepoIdType = iots.strict(
      {owner: iots.string, name: iots.string},
      "RepoId"
    );

    const GitHubConfigType = iots.strict(
      {repoIds: iots.readonlyArray(RepoIdType)},
      "GitHubConfig"
    );

    const RepoIdFromStringType = new iots.Type(
      "RepoIdFromString",
      function is(x: mixed): boolean {
        return typeof x === "string" && RepoIdStringPattern.test(x);
      },
      // TODO: use create our own Either<Errors, RepoId> Flow type to return.
      function decode(x: mixed, context): any {
        try {
          if (typeof x === "string") {
            return iots.success(stringToRepoId(x));
          }
        } catch (e) {
          // swallow error
        }
        return iots.failure(x, context);
      },
      // encode
      repoIdToString
    );

    const ParsingGitHubConfigType = iots.strict(
      {repoIds: iots.readonlyArray(RepoIdFromStringType)},
      "GitHubConfig"
    );

    it("should parse an empty example", () => {
      const json: JsonObject = {repoIds: []};
      const config = throwingDecode(json, GitHubConfigType);
      expect(config).toEqual(json);
    });

    it("should validate an object based example", () => {
      const json: JsonObject = {
        repoIds: [{owner: "missing repo"}, {owner: "foo", name: "bar"}],
      };
      const f = () => throwingDecode(json, GitHubConfigType);
      expect(f).toThrow(TypeError);
      expect(f).toThrow(
        `Validation failed on decode:` +
          `\n\tInvalid value undefined supplied to : GitHubConfig/repoIds: ReadonlyArray<RepoId>/0: RepoId/name: string`
      );
    });

    it("should decode valid RepoIdStrings to objects", () => {
      const json: JsonObject = {repoIds: ["sourcecred/sourcecred", "foo/bar"]};
      const config: GitHubConfig = throwingDecode(
        json,
        ParsingGitHubConfigType
      );
      expect(config).toEqual({
        repoIds: [
          {owner: "sourcecred", name: "sourcecred"},
          {owner: "foo", name: "bar"},
        ],
      });
    });

    it("should encode RepoIds back to strings", () => {
      const config = {
        repoIds: [
          {owner: "sourcecred", name: "sourcecred"},
          {owner: "foo", name: "bar"},
        ],
      };
      const json: JsonObject = ParsingGitHubConfigType.encode(config);
      expect(json).toEqual({repoIds: ["sourcecred/sourcecred", "foo/bar"]});
    });

    it("should throw when RepoId strings don't match pattern", () => {
      const json: JsonObject = {repoIds: ["foo/bar", "not-a-repoId"]};
      const f = () => throwingDecode(json, ParsingGitHubConfigType);
      expect(f).toThrow(TypeError);
      expect(f).toThrow(
        `Validation failed on decode:` +
          `\n\tInvalid value "not-a-repoId" supplied to : GitHubConfig/repoIds: ReadonlyArray<RepoIdFromString>/1: RepoId`
      );
    });
  });
});
