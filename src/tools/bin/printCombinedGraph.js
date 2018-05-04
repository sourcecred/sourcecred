/*
 * Command-line utility to fetch data for multiple plugins and print a combined
 * graph. Currently imports data from the Git and GitHub plugins.
 *
 * Usage:
 *
 *   node bin/printCombinedGraph.js REPO_OWNER REPO_NAME TOKEN
 *
 * where TOKEN is a GitHub authentication token, as generated from
 * https://github.com/settings/tokens/new.
 */

import stringify from "json-stable-stringify";
import {loadCombinedGraph} from "../loadCombinedGraph";

function parseArgs() {
  const argv = process.argv.slice(2);
  const fail = () => {
    const invocation = process.argv.slice(0, 2).join(" ");
    throw new Error(`Usage: ${invocation} REPO_OWNER REPO_NAME TOKEN`);
  };
  if (argv.length !== 3) {
    fail();
  }
  const [repoOwner, repoName, token] = argv;
  return {repoOwner, repoName, token};
}

function main() {
  const {repoOwner, repoName, token} = parseArgs();
  loadCombinedGraph(repoOwner, repoName, token)
    .then((data) => {
      console.log(stringify(data, {space: 4}));
    })
    .catch((errors) => {
      console.error("Errors processing the result:");
      console.error(errors);
      process.exit(1);
    });
}

main();
