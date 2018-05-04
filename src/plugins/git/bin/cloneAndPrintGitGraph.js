// @flow

/*
 * Command-line utility to load Git data using the API in
 * ../cloneGitGraph, and print it to stdout. Useful for testing or
 * saving some data to disk.
 *
 * Usage:
 *
 *   node bin/cloneAndPrintGitGraph.js REPO_OWNER REPO_NAME
 *
 */

import cloneGitGraph from "../cloneGitGraph";
import stringify from "json-stable-stringify";

function parseArgs() {
  const argv = process.argv.slice(2);
  const fail = () => {
    const invocation = process.argv.slice(0, 2).join(" ");
    throw new Error(`Usage: ${invocation} REPO_OWNER REPO_NAME`);
  };
  if (argv.length !== 2) {
    fail();
  }
  const [repoOwner, repoName] = argv;
  return {repoOwner, repoName};
}

function main() {
  const {repoOwner, repoName} = parseArgs();
  const graph = cloneGitGraph(repoOwner, repoName);
  console.log(stringify(graph, {space: 4}));
}

main();
