#!/bin/sh

# Disable these lint rules globally:
#   2034 = unused variable (used by sharness)
#   2016 = parameter expansion in single quotes
#   1004 = backslash-newline in single quotes
# shellcheck disable=SC2034,SC2016,SC1004
:

test_description='tests for cli/output.js'

export GIT_CONFIG_NOSYSTEM=1
export GIT_ATTR_NOSYSTEM=1

# shellcheck disable=SC1091
. ./sharness.sh

test_expect_success "environment and Node linking setup" '
    toplevel="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)" &&
    snapshot_directory="${toplevel}/sharness/__snapshots__/" &&
    SOURCECRED_DIRECTORY="${snapshot_directory}/example-github-load" &&
    export SOURCECRED_DIRECTORY &&
    snapshot_file="${snapshot_directory}/example-github-output.json" &&
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

test_expect_success SETUP  "should print help message when called without args" '
    test_must_fail run_without_validation output &&
    grep -q "no project ID provided" err &&
    grep -q "sourcecred help output" err
'

test_expect_success SETUP  "help should print usage info" '
    run help output &&
    grep -q "usage: sourcecred output PROJECT_ID" out
'

test_expect_success SETUP "--help should print usage info" '
    run output --help &&
    grep -q "usage: sourcecred output PROJECT_ID" out
'

test_expect_success SETUP "should fail for multiple projects" '
    test_must_fail run_without_validation output sourcecred/sourcecred torvalds/linux &&
    grep -q "fatal: multiple project IDs provided" err
'

test_expect_success SETUP "should fail for unloaded project" '
    test_must_fail run_without_validation output torvalds/linux &&
    grep -q "fatal: project torvalds/linux not loaded" err
'

if [ -n "${UPDATE_SNAPSHOT}" ]; then
    test_set_prereq UPDATE_SNAPSHOT
fi

test_expect_success SETUP,UPDATE_SNAPSHOT  "should update the snapshot" '
    run output sourcecred-test/example-github &&
    mv out "${snapshot_file}"
'

test_expect_success SETUP  "should be identical to the snapshot" '
    run output sourcecred-test/example-github &&
    diff -u out ${snapshot_file}
'

test_done
# vim: ft=sh
