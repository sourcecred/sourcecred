#!/bin/sh
CORE_PACKAGE_SUBPATH=$(lerna ll --loglevel=silent | grep ^sourcecred' ' | cut --delimiter=' ' --fields=3)
export CORE_PATH="$(git rev-parse --show-toplevel)/$CORE_PACKAGE_SUBPATH"
