#!/bin/sh
set -eu
git grep -Fz --files-without-match -e '@flow' -e '@no-flow' -- '*.js' \
    | grep -zv '^flow-typed/' \
    | tr '\0' '\n' \
    | tee /dev/stderr \
    | diff -q /dev/null - >/dev/null
