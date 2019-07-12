#!/bin/sh

# Disable these lint rules globally:
#   2034 = unused variable (used by sharness)
#   2016 = parameter expansion in single quotes
#   1004 = backslash-newline in single quotes
# shellcheck disable=SC2034,SC2016,SC1004
:

test_description='tests for scripts/build_static_site.sh'

export GIT_CONFIG_NOSYSTEM=1
export GIT_ATTR_NOSYSTEM=1

# shellcheck disable=SC1091
. ./sharness.sh

test_expect_success "environment and Node linking setup" '
    toplevel="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)" &&
    snapshot_directory="${toplevel}/sharness/__snapshots__/" &&
    SOURCECRED_DIRECTORY="${snapshot_directory}/example-github-load" &&
    snapshot_file="${snapshot_directory}/example-github-scores.json" &&
    if [ -z "${SOURCECRED_BIN}" ]; then
        printf >&2 "warn: missing environment variable SOURCECRED_BIN\n" &&
        printf >&2 "warn: using repository bin directory as fallback\n" &&
        export SOURCECRED_BIN="${toplevel}/bin"
    fi &&
    export NODE_PATH="${toplevel}/node_modules${NODE_PATH:+:${NODE_PATH}}" &&
    test_set_prereq SETUP
'

run() (
  set -eu
  rm -f out err
  node "${SOURCECRED_BIN}"/sourcecred.js "$@" >out 2>err
)

test_expect_success SETUP, \
  "should print help message when called without scores" '
  test_must_fail run scores &&
    grep -q "no repository ID provided" err &&
    grep -q "sourcecred help scores" err
'

test_expect_success SETUP, \
  "help should print usage info" '
  run help scores &&
    grep -q "usage: sourcecred scores REPO_ID" out
'

test_expect_success SETUP, \
  "--help should print usage info" '
  run scores --help &&
    grep -q "usage: sourcecred scores REPO_ID" out
'

test_expect_success SETUP, \
  "should fail for multiple repos" '
  test_must_fail run scores sourcecred/sourcecred torvalds/linux &&
    grep -q "fatal: multiple repository IDs provided" err
'

test_expect_success SETUP, \
  "should fail for unloaded repo" '
  test_must_fail run scores torvalds/linux &&
    grep -q "fatal: repository ID torvalds/linux not loaded" err
'

if [ -n "${UPDATE_SNAPSHOT}" ]; then
    test_set_prereq UPDATE_SNAPSHOT
fi

test_expect_success SETUP,UPDATE_SNAPSHOT \
    "should update the snapshot" '
    run scores sourcecred/example-github &&
    mv out ${snapshot_file}
'

test_expect_success SETUP \
    "should be identical to the snapshot" '
    run scores sourcecred/example-github &&
    diff -q out ${snapshot_file}
'

test_done
# vim: ft=sh
