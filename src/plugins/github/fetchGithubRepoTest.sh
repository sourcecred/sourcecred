#!/bin/bash

set -eu

data_file=src//plugins/github/example/example-github.json

usage() {
  printf 'usage: %s [-u|--updateSnapshot] [--[no-]build] [--help]\n' "$0"
  printf 'Required environment variables:\n'
  printf '  GITHUB_TOKEN: A 40-character hex string API token.\n'
  printf 'Flags:\n'
  printf '  -u|--updateSnapshot\n'
  printf '      Update the stored file instead of checking its contents\n'
  printf ' --[no-]build\n'
  printf '      Whether to run "yarn backend" before the test.\n'
  printf '      Default is --build.\n'
  printf '  --help\n'
  printf '      Show this message\n'
}

fetch() {
  if [ -z "${GITHUB_TOKEN:-}" ]; then
    printf >&2 'Please set the GITHUB_TOKEN environment variable\n'
    printf >&2 'to a 40-character hex string API token from GitHub.\n'
    return 1
  fi
  node bin/fetchAndPrintGithubRepo.js \
    sourcecred example-github "${GITHUB_TOKEN}"
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
    yarn backend
  fi
  if [ -n "${UPDATE}" ]; then
    update
  else
    check
  fi
}

main "$@"
