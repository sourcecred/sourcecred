#!/bin/bash

set -eu

data_file=src/v3/plugins/git/example/example-git.json

usage() {
  printf 'usage: %s [-u|--updateSnapshot] [--help]\n' "$0"
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
  tmpdir="$(mktemp -d)"
  node bin/createExampleRepoV3.js "${tmpdir}"
  node bin/loadAndPrintGitRepositoryV3.js "${tmpdir}"
  rm -rf "${tmpdir}"
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
