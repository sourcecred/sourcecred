#!/bin/bash

set -eu

data_file=src/plugins/github/example/organizations.snapshot

usage() {
  printf 'usage: %s [-u|--updateSnapshot] [--[no-]build] [--help]\n' "$0"
  printf 'Required environment variables:\n'
  printf '  SOURCECRED_GITHUB_TOKEN: A 40-character hex string API token.\n'
  printf 'Flags:\n'
  printf '  -u|--updateSnapshot\n'
  printf '      Update the stored file instead of checking its contents\n'
  printf ' --[no-]build\n'
  printf '      Whether to run "yarn build:backend" before the test.\n'
  printf '      Default is --build.\n'
  printf '  --help\n'
  printf '      Show this message\n'
  printf '\n'
  printf 'Environment variables:'
  printf '  SOURCECRED_BIN\n'
  printf '      When using --no-build, directory containing the SourceCred\n'
  printf '      executables (output of "yarn build:backend").\n'
  printf '      Default is ./bin.\n'
}

fetch() {
  if [ -z "${SOURCECRED_GITHUB_TOKEN:-}" ]; then
    printf >&2 'Please set the SOURCECRED_GITHUB_TOKEN environment variable\n'
    printf >&2 'to a 40-character hex string API token from GitHub.\n'
    return 1
  fi
  # Set the PAGE_SIZE to 1 to ensure pagination logic really works.
  PAGE_SIZE=1
  echo "# results for org: sourcecred-test-organization"
  node "${SOURCECRED_BIN:-./bin}/fetchAndPrintGithubOrg.js" \
    sourcecred-test-organization "${SOURCECRED_GITHUB_TOKEN}" "${PAGE_SIZE}"
  echo
  echo "# results for org: sourcecred-empty-organization"
  node "${SOURCECRED_BIN:-./bin}/fetchAndPrintGithubOrg.js" \
    sourcecred-empty-organization "${SOURCECRED_GITHUB_TOKEN}" "${PAGE_SIZE}"
  echo
  echo "# results for org: sourcecred-nonexistent-organization"
  node "${SOURCECRED_BIN:-./bin}/fetchAndPrintGithubOrg.js" \
    sourcecred-nonexistent-organization "${SOURCECRED_GITHUB_TOKEN}" "${PAGE_SIZE}"
}

check() {
  output="$(mktemp)"
  fetch >"${output}"
  diff -uw "${data_file}" "${output}"
  rm "${output}"
}

update() {
  fetch >"${data_file}"
}

main() {
  if [ -n "${SOURCECRED_BIN:-}" ]; then
    BIN="$(readlink -f "${SOURCECRED_BIN}")"
  fi
  cd "$(git rev-parse --show-toplevel)/packages/sourcecred"
  UPDATE=
  BUILD=1
  while [ $# -gt 0 ]; do
    if [ "$1" = "--help" ]; then
      usage
      return 0
    elif [ "$1" = "-u" ] || [ "$1" = "--updateSnapshot" ]; then
      UPDATE=1
    elif [ "$1" = "--build" ]; then
      BUILD=1
    elif [ "$1" = "--no-build" ]; then
      BUILD=
    else
      usage >&2
      return 1
    fi
    shift
  done
  if [ -n "${BUILD}" ]; then
    unset BIN
    yarn build:backend
  else
    export NODE_PATH="./node_modules${NODE_PATH:+:${NODE_PATH}}"
  fi
  if [ -n "${UPDATE}" ]; then
    update
  else
    check
  fi
}

main "$@"
