#!/bin/sh

# Disable these lint rules globally:
#   2034 = unused variable (used by sharness)
#   2016 = parameter expansion in single quotes
#   1004 = backslash-newline in single quotes
# shellcheck disable=SC2034,SC2016,SC1004
:

# If this test is failing, it probably means you need to update snapshots.
# You can do so by setting your SOURCECRED_GITHUB_TOKEN (see README) and then
# running scripts/update_snapshots.sh.

test_description='test snapshot integrity for sourcecred instance loading'

export GIT_CONFIG_NOSYSTEM=1
export GIT_ATTR_NOSYSTEM=1

# shellcheck disable=SC1091
. ./sharness.sh

toplevel="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
cd "${toplevel}" || exit 1
. $toplevel/scripts/monorepo_vars.sh
cd "${CORE_PATH}" || exit 1

test_expect_success "environment and Node linking setup" '
    snapshot_directory="${CORE_PATH}/sharness/__snapshots__/test-instance/" &&
    if [ -z "${SOURCECRED_BIN}" ]; then
        printf >&2 "warn: missing environment variable SOURCECRED_BIN\n" &&
        printf >&2 "warn: using repository bin directory as fallback\n" &&
        export SOURCECRED_BIN="${CORE_PATH}/bin"
    fi &&
    export NODE_PATH="${CORE_PATH}/node_modules${NODE_PATH:+:${NODE_PATH}}" &&
    test_set_prereq SETUP
'

if [ -n "${SOURCECRED_GITHUB_TOKEN:-}" ]; then
    test_set_prereq HAVE_GITHUB_TOKEN
fi

test_expect_success EXPENSIVE,SETUP,HAVE_GITHUB_TOKEN \
    "should load the example instance" '
    cp -r "${snapshot_directory}" . &&
    cd test-instance &&
    node "${SOURCECRED_BIN}/sourcecred.js" go &&
    rm -rf cache &&
    test_set_prereq LOADED
'

if [ -n "${UPDATE_SNAPSHOT}" ]; then
    test_set_prereq UPDATE_SNAPSHOT
fi

test_expect_success LOADED,UPDATE_SNAPSHOT \
    "should update the snapshot" '
    rm -rf "$snapshot_directory" &&
    cp -r . "$snapshot_directory"
'

test_expect_success LOADED "should be identical to the snapshot" '
    diff -qr . "$snapshot_directory"
'

test_done

# vim: ft=sh
