// @flow
/*
 * Command-line utility to fetch GitHub data using the API in
 * ../fetchGithubOrg, and print it to stdout. Useful for testing or
 * saving some data to disk.
 *
 * Usage:
 *
 *   node bin/fetchAndPrintGithubOrg.js ORGANIZATION_NAME GITHUB_TOKEN [PAGE_SIZE]
 *
 * where GITHUB_TOKEN is a GitHub authentication token, as generated
 * from https://github.com/settings/tokens/new.
 */

import stringify from "json-stable-stringify";

import {fetchGithubOrg} from "../fetchGithubOrg";
import {validateToken} from "../token";

function parseArgs() {
  const argv = process.argv.slice(2);
  const fail = () => {
    const invocation = process.argv.slice(0, 2).join(" ");
    throw new Error(
      `Usage: ${invocation} ORGANIZATION_NAME GITHUB_TOKEN [PAGE_SIZE]`
    );
  };
  if (argv.length < 2) {
    fail();
  }
  const [organization, unvalidatedGithubToken, ...rest] = argv;
  let pageSize: ?number;
  if (rest.length === 1) {
    pageSize = Number(rest[0]);
  }
  const githubToken = validateToken(unvalidatedGithubToken);
  const result = {organization, githubToken, pageSize};
  if (rest.length > 1) {
    fail();
  }
  return result;
}

function main() {
  const {organization, githubToken, pageSize} = parseArgs();
  fetchGithubOrg(organization, githubToken, pageSize)
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
