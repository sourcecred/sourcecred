#!/bin/sh
# shellcheck disable=SC2016

export GIT_CONFIG_NOSYSTEM=1
export GIT_ATTR_NOSYSTEM=1

# shellcheck disable=SC2034
test_description='check that each JavaScript test has a "describe" block with its own filename'

# shellcheck disable=SC1091
. ./sharness.sh

test_expect_success "setup" '
    root="$(git rev-parse --show-toplevel)" &&
    (cd "${root}/src" && git ls-files -z "*.test.js") >test_files_z &&
    tr "\0" "\n" <test_files_z >test_files &&
    test_set_prereq SETUP
'

# We read file names delimited by newline. This could theoretically fail
# if we were to check in a test file with a newline in its name.
# Happily, doing so would be highly questionable anyway.
while read -r filename; do
    test_expect_success SETUP "test file: ${filename}" '
        grep "^describe\(\.skip\)\?(" -- "${root}/src/${filename}" >describes &&
        grep -F -- "${filename%.test.js}" describes
    '
done <test_files

test_done

# vim: ft=sh
