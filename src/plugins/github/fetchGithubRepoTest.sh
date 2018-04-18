#!/bin/bash

set -eu

data_file=src/plugins/github/demoData/example-repo.json

usage() {
  printf 'usage: %s [-u|--updateSnapshot] [--help]\n' "$0"
  printf 'Required environment variables:\n'
  printf '  GITHUB_TOKEN: A 40-character hex string API token.\n'
  printf 'Flags:\n'
  printf '  -u|--updateSnapshot\n'
  printf '      Update the stored file instead of checking its contents\n'
  printf '  --help\n'
  printf '      Show this message\n'
}

fetch() {
  if [ -z "${GITHUB_TOKEN:-}" ]; then
    printf >&2 'Please set the GITHUB_TOKEN environment variable\n'
    printf >&2 'to a 40-character hex string API token from GitHub.\n'
    return 1
  fi
  yarn backend >&2
  node bin/fetchAndPrintGithubRepo.js \
    sourcecred example-repo "${GITHUB_TOKEN}"
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
  cd "$(git rev-parse --show-toplevel)"
  if [ $# -eq 0 ]; then
    check
  elif [ $# -eq 1 ]; then
    if [ "$1" = "-u" ] || [ "$1" = "--updateSnapshot" ]; then
      update
    elif [ "$1" = "--help" ]; then
      usage
    else
      usage >&2
      return 1
    fi
  else
    usage >&2
    return 1
  fi
}

main "$@"
