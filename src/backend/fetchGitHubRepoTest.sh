#!/bin/bash

set -eu

canonicalize() {
  script="$(cat <<EOF
import json
import sys
blob = json.load(sys.stdin)
json.dump(blob, sys.stdout, indent=4, sort_keys=True)
EOF
)"
  python -c "${script}"
}

main() {
  if [ -z "${GITHUB_TOKEN:-}" ]; then
    printf >&2 'Please set the GITHUB_TOKEN environment variable\n'
    printf >&2 'to a 40-character hex string API token from GitHub.\n'
    return 1
  fi
  output="$(mktemp)"
  node src/backend/bin/fetchAndPrintGitHubRepo.js \
    sourcecred tiny-example-repository "${GITHUB_TOKEN}" \
    >"${output}" \
    ;
  diff -uw \
    <(canonicalize <src/backend/githubDemoData/tiny-example-repository.json) \
    <(canonicalize <"${output}") \
    ;
  rm "${output}"
}

main "$@"
