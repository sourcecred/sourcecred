// @flow
//
// Command-line entry point for src/graphql/mirror.js, mostly for
// testing purposes. Downloads and prints all nodes reachable from an
// arbitrary root node. To use this module, first obtain the typename
// and ID of a GraphQL object to query. Here are some repository IDs
// (typename "Repository"):
//
//   - sourcecred/sourcecred: MDEwOlJlcG9zaXRvcnkxMjAxNDU1NzA=
//   - sourcecred/example-github: id: MDEwOlJlcG9zaXRvcnkxMjMyNTUwMDY=
//
// Then, invoke this program, passing the name of a persistent database
// file, the typename and ID from above, and a TTL in seconds. The
// provided object and all its transitive dependencies will be updated
// if absent or older than the TTL, then printed in structured form.
//
import Database from "better-sqlite3";

import {postQuery} from "../plugins/github/fetchGithubRepo";

import {Mirror} from "./mirror";
import * as Queries from "./queries";
import * as Schema from "./schema";

require("../tools/entry");

main();

async function main() {
  const [_unused_node, scriptName, ...args] = process.argv;
  const token = process.env.SOURCECRED_GITHUB_TOKEN;
  if (args.length !== 4 || token == null) {
    console.error(`usage: node ${scriptName} DB_FILE TYPENAME ID TTL_SECONDS`);
    console.error("Required arguments:");
    console.error("  DB_FILE: filepath in which to store a database");
    console.error("  TYPENAME: GraphQL typename of the root object");
    console.error("  ID: GraphQL ID for an object to fetch");
    console.error("  TTL_SECONDS: Fetch updates if more than this old");
    console.error("Required environment variables:");
    const url = "https://github.com/settings/tokens";
    console.error(`  SOURCECRED_GITHUB_TOKEN: ${url}`);
    console.error("Optional environment variables:");
    console.error("  NODES_LIMIT: positive integer (default 100)");
    console.error("  CONNECTION_PAGE_SIZE: integer 1..100 (default) inclusive");
    console.error("  CONNECTION_LIMIT: positive integer (default 100)");
    process.exitCode = 1;
    return;
  }
  const [dbFilename, typename, id, ttlSecondsString] = args;

  const db = new Database(dbFilename);
  const mirror = new Mirror(db, schema());
  console.warn("Registering...");
  mirror.registerObject({typename, id});
  console.warn("Updating...");
  await mirror.update(
    async (payload) => {
      console.warn("[Posting query...]");
      console.warn(
        JSON.stringify({
          type: "REQUEST",
          graphql: Queries.stringify.body(payload.body, Queries.inlineLayout()),
        })
      );
      const result = await postQuery(payload, token);
      console.warn("[Processing result...]");
      console.warn(JSON.stringify({type: "RESPONSE", result}));
      return result;
    },
    {
      nodesLimit: +(process.env.NODES_LIMIT || 100),
      nodesOfTypeLimit: 100,
      connectionPageSize: +(process.env.CONNECTION_PAGE_SIZE || 100),
      connectionLimit: +(process.env.CONNECTION_LIMIT || 100),
      since: new Date(new Date() - +ttlSecondsString * 1000),
      now: () => new Date(),
    }
  );
  console.warn("Extracting...");
  const result = mirror.extract(id);
  console.log(JSON.stringify(result, null, 4));
}

function schema(): Schema.Schema {
  const s = Schema;
  const types: {[Schema.Typename]: Schema.NodeType} = {
    Repository: s.object({
      id: s.id(),
      url: s.primitive(),
      name: s.primitive(),
      owner: s.node("RepositoryOwner"),
      issues: s.connection("Issue"),
      pullRequests: s.connection("PullRequest"),
      defaultBranchRef: s.node("Ref"),
    }),
    Issue: s.object({
      id: s.id(),
      url: s.primitive(),
      title: s.primitive(),
      body: s.primitive(),
      number: s.primitive(),
      author: s.node("Actor"),
      comments: s.connection("IssueComment"),
      reactions: s.connection("Reaction"),
    }),
    PullRequest: s.object({
      id: s.id(),
      url: s.primitive(),
      title: s.primitive(),
      body: s.primitive(),
      number: s.primitive(),
      mergeCommit: s.node("Commit"),
      additions: s.primitive(),
      deletions: s.primitive(),
      author: s.node("Actor"),
      comments: s.connection("IssueComment"), // yes, PRs have IssueComments
      reviews: s.connection("PullRequestReview"),
      reactions: s.connection("Reaction"),
    }),
    IssueComment: s.object({
      id: s.id(),
      url: s.primitive(),
      body: s.primitive(),
      author: s.node("Actor"),
      reactions: s.connection("Reaction"),
    }),
    PullRequestReview: s.object({
      id: s.id(),
      url: s.primitive(),
      body: s.primitive(),
      author: s.node("Actor"),
      state: s.primitive(),
      comments: s.connection("PullRequestReviewComment"),
    }),
    PullRequestReviewComment: s.object({
      id: s.id(),
      url: s.primitive(),
      body: s.primitive(),
      author: s.node("Actor"),
      reactions: s.connection("Reaction"),
    }),
    Reaction: s.object({
      id: s.id(),
      content: s.primitive(),
      user: s.node("User"),
    }),
    Ref: s.object({
      id: s.id(),
      target: s.node("GitObject"),
    }),
    GitObject: s.union(["Blob", "Commit", "Tag", "Tree"]),
    Blob: s.object({
      id: s.id(),
      oid: s.primitive(),
    }),
    Commit: s.object({
      id: s.id(),
      url: s.primitive(),
      oid: s.primitive(),
      message: s.primitive(),
      author: /* GitActor */ s.nested({
        date: s.primitive(),
        user: s.node("User"),
      }),
    }),
    Tag: s.object({
      id: s.id(),
      oid: s.primitive(),
    }),
    Tree: s.object({
      id: s.id(),
      oid: s.primitive(),
      name: s.primitive(),
    }),
    Actor: s.union(["User", "Bot", "Organization"]), // actually an interface
    RepositoryOwner: s.union(["User", "Organization"]), // actually an interface
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
  return s.schema(types);
}
