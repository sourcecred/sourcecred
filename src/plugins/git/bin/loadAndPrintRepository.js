/*
 * Command-line utility to load a Git repository into memory and then
 * print the resulting JSON representation.
 *
 * Usage:
 *
 *   node bin/loadAndPrintGitRepository.js PATH [ROOT_REF]
 *
 * where PATH is the path on disk to a Git repository, and ROOT_REF is
 * the revision to load (defaults to HEAD).
 */
// @flow

import stringify from "json-stable-stringify";

import {loadRepository} from "../loadRepository";

function parseArgs() {
  const argv = process.argv.slice(2);
  if (argv.length !== 1 && argv.length !== 2) {
    const invocation = process.argv.slice(0, 2).join(" ");
    throw new Error(`Usage: ${invocation} PATH`);
  }
  return {
    repositoryPath: argv[0],
    rootRef: argv.length > 1 ? argv[1] : "HEAD",
  };
}

function main() {
  const args = parseArgs();
  const result = loadRepository(args.repositoryPath, args.rootRef);
  console.log(stringify(result, {space: 4}));
}

main();
