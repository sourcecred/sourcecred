#!/bin/bash

set -eu

data_file=src/plugins/git/example/example-git.json

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
  printf '\n'
  printf 'Environment variables:'
  printf '  SOURCECRED_BIN\n'
  printf '      When using --no-build, directory containing the SourceCred\n'
  printf '      executables (output of "yarn backend"). Default is ./bin.\n'
}

fetch() {
  tmpdir="$(mktemp -d)"
  SOURCECRED_DIRECTORY="${tmpdir}" \
    node "${SOURCECRED_BIN:-./bin}/sourcecred.js" \
    load --plugin git \
    sourcecred/example-git
  python -m json.tool "${tmpdir}"/data/sourcecred/example-git/git/repository.json
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
  if [ -n "${SOURCECRED_BIN:-}" ]; then
    SOURCECRED_BIN="$(readlink -f "${SOURCECRED_BIN}")"
  fi
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
    unset SOURCECRED_BIN
    yarn backend
  else
    export NODE_PATH=./node_modules"${NODE_PATH:+:${NODE_PATH}}"
  fi
  if [ -n "${UPDATE}" ]; then
    update
  else
    check
  fi
}

main "$@"
