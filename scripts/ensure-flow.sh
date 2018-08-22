#!/bin/sh
set -eu
! git grep -F --files-without-match -e '@flow' -e '@no-flow' \
        -- ':/*.js' ':!/flow-typed/' >&2
