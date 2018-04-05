// @flow

import type {Body} from "../../graphql/queries";
import {build} from "../../graphql/queries";

export function createQuery(): Body {
  const b = build;
  const makePageInfo = () => b.field("pageInfo", {}, [b.field("hasNextPage")]);
  const makeAuthor = () => b.field("author", {}, [b.fragmentSpread("whoami")]);
  const body: Body = [
    b.query(
      "FetchData",
      [b.param("repoOwner", "String!"), b.param("repoName", "String!")],
      [
        b.field(
          "repository",
          {owner: b.variable("repoOwner"), name: b.variable("repoName")},
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
                        b.field("url"),
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

export function createVariables(repoOwner: string, repoName: string) {
  return {repoOwner, repoName};
}
