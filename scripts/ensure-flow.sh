#!/bin/bash
set -eu
comm -13 -z \
  <(git grep -z --name-only -e @flow -e @no-flow | sort -z) \
  <(find src config scripts -name '*.js' -print0 | sort -z) \
  | tr '\0' '\n' \
  | diff -u /dev/null -
