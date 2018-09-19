// @flow

import type {Body} from "./queries";
import {build, stringify, multilineLayout, inlineLayout} from "./queries";

describe("graphql/queries", () => {
  describe("end-to-end-test cases", () => {
    const testCases = {
      "a query using lots of features": featurefulQuery,
      "a useful query": usefulQuery,
    };
    Object.keys(testCases).forEach((key) => {
      describe(`for ${key}`, () => {
        const testCase = testCases[key];
        it("should build the query", () => {
          expect(testCase()).toMatchSnapshot();
        });
        it("should stringify as multiline", () => {
          const result = stringify.body(testCase(), multilineLayout("  "));
          expect(result).toMatchSnapshot();
        });
        it("should stringify as inline", () => {
          const result = stringify.body(testCase(), inlineLayout());
          expect(result).toMatchSnapshot();
        });
      });
    });
  });
  describe("complex object stringification", () => {
    const object = () => {
      const b = build;
      return b.object({
        exampleNumber: b.literal(123),
        exampleString: b.literal("hello"),
        exampleBoolean: b.literal(true),
        exampleNull: b.literal(null),
        exampleEnum: b.enumLiteral("WORLD"),
        exampleVariable: b.variable("widget"),
        exampleList: b.list([b.literal(12), b.literal(14), b.literal(16)]),
        exampleObject: b.object({
          roses: b.literal("red"),
          violets: b.literal("blue"),
        }),
        nestedList: b.list([
          b.list([b.literal("w"), b.literal("x")]),
          b.list([b.literal("y"), b.literal("z")]),
        ]),
        nestedObject: b.object({
          english: b.object({
            n1: b.literal("one"),
            n2: b.literal("two"),
          }),
          greek: b.object({
            n1: b.literal("ένα"),
            n2: b.literal("δύο"),
          }),
        }),
      });
    };
    it("should build the object", () => {
      expect(object()).toMatchSnapshot();
    });
    it("should work multiline", () => {
      const result = stringify.value(object(), multilineLayout("  "));
      expect(result).toMatchSnapshot();
    });
    it("should work inline", () => {
      const result = stringify.value(object(), inlineLayout());
      expect(result).toMatchSnapshot();
    });
  });
});

function featurefulQuery(): Body {
  const b = build;
  const body: Body = [
    b.query(
      "QueryWithParameters",
      [b.param("qp1", "String!"), b.param("qp2", "String!")],
      [
        b.field("thing", {id: b.literal(12345), name: b.variable("qp1")}, [
          b.field("fruit", {
            type: b.enumLiteral("APPLE"),
            tasty: b.literal(true),
          }),
          b.fragmentSpread("otherThings"),
        ]),
        b.field("more", {}, [
          b.inlineFragment("Widget", [
            b.field("mcguffins", {}, [b.field("quantity")]),
            b.alias(
              "goo",
              b.field("slime", {state: b.enumLiteral("SLIMY")}, [
                b.field("availability"),
              ])
            ),
          ]),
          b.inlineFragment("Gizmo", [
            b.field("cogs", {
              attributes: b.object({
                teeth: b.list([b.literal(12), b.literal(14), b.literal(16)]),
                shaft: b.literal(null),
              }),
            }),
          ]),
          b.inlineFragment(null, [b.field("__typename"), b.field("id")]),
        ]),
      ]
    ),
    b.query(
      "QueryWithoutParameters",
      [],
      [b.field("rateLimit", {}, [b.field("remaining")])]
    ),
    b.fragment("otherThings", "Thing", [
      b.field("__typename"),
      b.field("quality"),
    ]),
  ];
  return body;
}

function usefulQuery(): Body {
  const b = build;
  const makePageInfo = () => b.field("pageInfo", {}, [b.field("hasNextPage")]);
  const makeAuthor = () => b.field("author", {}, [b.fragmentSpread("whoami")]);
  const body: Body = [
    b.query(
      "FetchData",
      [b.param("owner", "String!"), b.param("name", "String!")],
      [
        b.field(
          "repository",
          {owner: b.variable("owner"), name: b.variable("name")},
          [
            b.field("issues", {first: b.literal(100)}, [
              makePageInfo(),
              b.field("nodes", {}, [
                b.field("id"),
                b.field("title"),
                b.field("body"),
                b.field("number"),
                makeAuthor(),
                b.field("comments", {first: b.literal(20)}, [
                  makePageInfo(),
                  b.field("nodes", {}, [
                    b.field("id"),
                    makeAuthor(),
                    b.field("body"),
                    b.field("url"),
                  ]),
                ]),
              ]),
            ]),
            b.field("pullRequests", {first: b.literal(100)}, [
              makePageInfo(),
              b.field("nodes", {}, [
                b.field("id"),
                b.field("title"),
                b.field("body"),
                b.field("number"),
                makeAuthor(),
                b.field("comments", {first: b.literal(20)}, [
                  makePageInfo(),
                  b.field("nodes", {}, [
                    b.field("id"),
                    makeAuthor(),
                    b.field("body"),
                    b.field("url"),
                  ]),
                ]),
                b.field("reviews", {first: b.literal(10)}, [
                  makePageInfo(),
                  b.field("nodes", {}, [
                    b.field("id"),
                    b.field("body"),
                    makeAuthor(),
                    b.field("state"),
                    b.field("comments", {first: b.literal(10)}, [
                      makePageInfo(),
                      b.field("nodes", {}, [
                        b.field("id"),
                        b.field("body"),
                        makeAuthor(),
                      ]),
                    ]),
                  ]),
                ]),
              ]),
            ]),
          ]
        ),
      ]
    ),
    b.fragment("whoami", "Actor", [
      b.field("__typename"),
      b.field("login"),
      b.inlineFragment("User", [b.field("id")]),
      b.inlineFragment("Organization", [b.field("id")]),
      b.inlineFragment("Bot", [b.field("id")]),
    ]),
  ];
  return body;
}
