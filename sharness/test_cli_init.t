#!/bin/sh

# Disable these lint rules globally:
#   2034 = unused variable (used by sharness)
#   2016 = parameter expansion in single quotes
#   1004 = backslash-newline in single quotes
# shellcheck disable=SC2034,SC2016,SC1004
:

test_description='tests for cli/init.js'

export GIT_CONFIG_NOSYSTEM=1
export GIT_ATTR_NOSYSTEM=1

# shellcheck disable=SC1091
. ./sharness.sh

test_expect_success "environment and Node linking setup" '
    toplevel="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)" &&
    snapshot_directory="${toplevel}/sharness/__snapshots__/" &&
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
    code=0
    node "${SOURCECRED_BIN}"/sourcecred.js "$@" >out 2>err || code=$?
    if [ "${code}" -ne 0  ]; then
        printf '%s failed with %d\n' "sourcecred $*"
        printf 'stdout:\n'
        cat out
        printf 'stderr:\n'
        cat err
    fi
)

# Use this instead of `run` when we are expecting sourcecred to return a
# non-zero exit code
run_without_validation() (
    set -eu
    rm -f out err
    node "${SOURCECRED_BIN}"/sourcecred.js "$@" >out 2>err
)

if [ -n "${SOURCECRED_GITHUB_TOKEN:-}" ]; then
    test_set_prereq HAVE_GITHUB_TOKEN
fi

test_expect_success SETUP  "help should print usage info" '
    run help init &&
    grep -q "usage: sourcecred init" out
'

test_expect_success SETUP "--help should print usage info" '
    run init --help &&
    grep -q "usage: sourcecred init" out
'

test_expect_success SETUP "should fail for multiple discourse urls" '
    test_must_fail run_without_validation init \
      --discourse https://discourse.sourcecred.io \
      --discourse https://discourse2.sourcecred.io \
      &&
    grep -q "fatal: --discourse given multiple times" err
'

test_expect_success SETUP "should fail for incomplete discourse args" '
    test_must_fail run_without_validation init --discourse &&
    grep -q "fatal: --discourse given without value" err
'

test_expect_success SETUP "should fail for invalid discourse urls" '
    test_must_fail run_without_validation init \
      --discourse discourse.sourcecred.io \
      &&
    grep -q "fatal: invalid discourse url: must start with http:// or https://" err
'

test_expect_success SETUP "should strip trailing slash from discourse url" '
    run --discourse https://discourse.sourcecred.io --print &&
    mv out clean &&
    run --discourse https://discourse.sourcecred.io/ --print &&
    diff -u clean out
'

test_expect_success SETUP "should fail for incomplete github args" '
    test_must_fail run_without_validation init --github &&
    grep -q "fatal: --github given without value" err
'

test_expect_success SETUP "should fail if github specs are provided without github token" '
    (
      unset SOURCECRED_GITHUB_TOKEN &&
      test_must_fail run_without_validation init --github foo
    ) &&
    grep -q "fatal: tried to load GitHub specs, but no GitHub token provided" err
'

test_expect_success SETUP "should write the project to sourcecred.json (or to stdout with --print)" '
    rm -f sourcecred.json &&
    run init &&
    run init --print &&
    diff -u out sourcecred.json &&
    rm sourcecred.json
'

test_expect_success SETUP "should refuse to overwrite sourcecred.json without --force" '
    printf "foo" > sourcecred.json &&
    test_must_fail run_without_validation init &&
    grep -q "fatal: refusing to overwrite sourcecred.json without --force" err
'

test_expect_success SETUP "should overwrite sourcecred.json if --force is provided" '
    printf "foo" > sourcecred.json &&
    run init --force &&
    run init --print &&
    diff -u out sourcecred.json
'

test_expect_success SETUP "should not touch sourcecred.json if both --force and --print are provided" '
    printf "foo" > sourcecred.json &&
    printf "foo" > expected &&
    run init --force --print &&
    mv out out1 &&
    run init --print &&
    diff -u out out1 &&
    diff -u sourcecred.json expected
'

if [ -n "${UPDATE_SNAPSHOT}" ]; then
    test_set_prereq UPDATE_SNAPSHOT
fi

test_expect_success SETUP,UPDATE_SNAPSHOT,HAVE_GITHUB_TOKEN  "should update the snapshots" '
    run init --print &&
    mv out "${snapshot_directory}/empty.json" &&
    run init \
      --print \
      --discourse https://discourse.sourcecred.io \
      --github @sourcecred-test \
      --github sourcecred/sourcecred \
      &&
    mv out "${snapshot_directory}/full.json"
'

test_expect_success SETUP  "should produce an empty project config when called without args" '
    run init --print &&
    diff -u out "${snapshot_directory}/empty.json"
'

test_expect_success SETUP,HAVE_GITHUB_TOKEN "can include github and discourse specs" '
    run init \
      --print \
      --discourse https://discourse.sourcecred.io \
      --github @sourcecred-test \
      --github sourcecred/sourcecred \
      &&
    diff -u out "${snapshot_directory}/full.json"
'

test_done
# vim: ft=sh
