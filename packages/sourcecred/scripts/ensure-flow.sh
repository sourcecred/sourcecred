#!/bin/sh
set -eu
! git grep -F --files-without-match -e '@flow' -e '@no-flow' \
        -- ':/*.js' ':!/packages/sourcecred/flow-typed/' >&2
