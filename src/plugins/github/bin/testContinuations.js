// @flow
// Ad hoc testing script for RelationalView input format consistency.

import Database from "better-sqlite3";
import fs from "fs-extra";
import stringify from "json-stable-stringify";
import deepEqual from "lodash.isequal";

import {makeRepoId} from "../../../core/repoId";
import {Mirror} from "../../../graphql/mirror";
import fetchGithubRepo, {postQuery} from "../fetchGithubRepo";
import type {Repository} from "../graphqlTypes";
import {RelationalView, type RelationalViewJSON} from "../relationalView";
import githubSchema from "../schema";

async function test(options: {|
  +token: string,
  +owner: string,
  +name: string,
  +graphqlId: string,
  +outputFilepaths: {|
    +continuations: string,
    +mirror: string,
  |},
|}) {
  async function fetchViaContinuations(): Promise<RelationalViewJSON> {
    const raw = await fetchGithubRepo(
      makeRepoId(options.owner, options.name),
      options.token
    );
    const rv = new RelationalView();
    rv.addData(raw);
    return rv.toJSON();
  }

  async function fetchViaMirror(): Promise<RelationalViewJSON> {
    const mirror = new Mirror(new Database(":memory:"), githubSchema());
    mirror.registerObject({typename: "Repository", id: options.graphqlId});
    await mirror.update((payload) => postQuery(payload, options.token), {
      nodesLimit: 100,
      nodesOfTypeLimit: 100,
      connectionPageSize: 100,
      connectionLimit: 100,
      since: new Date(0),
      now: () => new Date(),
    });
    const repository = ((mirror.extract(options.graphqlId): any): Repository);
    const rv = new RelationalView();
    rv.addRepository(repository);
    return rv.toJSON();
  }

  function saveTo(filename: string, repo: RelationalViewJSON): Promise<void> {
    return fs.writeFile(filename, stringify(repo));
  }

  const [viaContinuations, viaMirror] = await Promise.all([
    fetchViaContinuations(),
    fetchViaMirror(),
  ]);

  if (deepEqual(viaContinuations, viaMirror)) {
    console.log("Identical. Saving to disk...");
  } else {
    console.log("Different. Saving to disk...");
  }

  await Promise.all([
    saveTo(options.outputFilepaths.continuations, viaContinuations),
    saveTo(options.outputFilepaths.mirror, viaMirror),
  ]);
}

async function main() {
  const args = process.argv.slice(2);
  const token = process.env.SOURCECRED_GITHUB_TOKEN;
  if (args.length !== 5 || token == null) {
    const invocation = [
      "SOURCECRED_GITHUB_TOKEN=<token>",
      "node",
      "test.js",
      "REPO_OWNER",
      "REPO_NAME",
      "GRAPHQL_ID",
      "CONTINUATIONS_OUTPUT_FILENAME",
      "MIRROR_OUTPUT_FILENAME",
    ];
    console.error("usage: " + invocation.join(" "));
    process.exitCode = 1;
    return;
  }
  const [owner, name, graphqlId, continuations, mirror] = args;
  const options = {
    token,
    owner,
    name,
    graphqlId,
    outputFilepaths: {
      continuations,
      mirror,
    },
  };
  await test(options);
}

main();
