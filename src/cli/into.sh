#!/bin/sh
# Utility for redirection.
set -eu
if [ $# -eq 0 ]; then
    printf >&2 'into: fatal: no target provided\n'
    exit 1
fi
target="$1"
shift
exec "$@" >"${target}"
