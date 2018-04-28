#!/bin/bash

set -eu

data_file=src/plugins/git/demoData/example-git.json

usage() {
  printf 'usage: %s [-u|--updateSnapshot] [--help]\n' "$0"
  printf 'Flags:\n'
  printf '  -u|--updateSnapshot\n'
  printf '      Update the stored file instead of checking its contents\n'
  printf '  --help\n'
  printf '      Show this message\n'
}

fetch() {
  yarn backend >&2
  tmpdir="$(mktemp -d)"
  node bin/createExampleRepo.js "${tmpdir}"
  node bin/loadAndPrintGitRepository.js "${tmpdir}"
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
