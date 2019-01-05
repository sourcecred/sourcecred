#!/bin/sh
set -eu

if ! 2>/dev/null >/dev/null readlink -f . ; then
  >&2 echo "Error: Your environment does not provide GNU coreutils"
  >&2 echo "You're likely developing on macOS."
  >&2 echo "Please see the following link for a fix:"
  >&2 echo "https://github.com/sourcecred/sourcecred/issues/698#issuecomment-417202213"
  exit 1
fi
