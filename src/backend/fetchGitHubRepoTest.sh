#!/bin/bash

set -eu

main() {
  if ! [ -d bin ]; then
    printf >&2 'Backend applications have not been built.\n'
    printf >&2 'Please run "yarn backend".\n'
    return 1
  fi
  if [ -z "${GITHUB_TOKEN:-}" ]; then
    printf >&2 'Please set the GITHUB_TOKEN environment variable\n'
    printf >&2 'to a 40-character hex string API token from GitHub.\n'
    return 1
  fi
  output="$(mktemp)"
  node bin/fetchAndPrintGitHubRepo.js \
    sourcecred example-repo "${GITHUB_TOKEN}" \
    >"${output}" \
    ;
  diff -uw \
    src/backend/githubDemoData/example-repo.json \
    "${output}" \
    ;
  rm "${output}"
}

main "$@"
