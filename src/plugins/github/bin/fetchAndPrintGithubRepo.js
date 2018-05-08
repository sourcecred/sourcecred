// @no-flow
/*
 * Command-line utility to fetch GitHub data using the API in
 * ../fetchGithubRepo, and print it to stdout. Useful for testing or
 * saving some data to disk.
 *
 * Usage:
 *
 *   node bin/fetchAndPrintGithubRepo.js REPO_OWNER REPO_NAME [TOKEN]
 *
 * where TOKEN is an optional GitHub authentication token, as generated
 * from https://github.com/settings/tokens/new.
 */

import fetchGithubRepo from "../fetchGithubRepo";
import stringify from "json-stable-stringify";

function parseArgs() {
  const argv = process.argv.slice(2);
  const fail = () => {
    const invocation = process.argv.slice(0, 2).join(" ");
    throw new Error(`Usage: ${invocation} REPO_OWNER REPO_NAME [TOKEN]`);
  };
  if (argv.length < 2) {
    fail();
  }
  const [repoOwner, repoName, ...rest] = argv;
  const result = {repoOwner, repoName};
  if (rest.length === 1) {
    result.token = rest[0];
  } else if (rest.length > 1) {
    fail();
  }
  return result;
}

function main() {
  const args = parseArgs();
  fetchGithubRepo(args.repoOwner, args.repoName, args.token)
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
