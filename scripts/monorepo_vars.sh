#!/bin/sh
export CORE_PATH="$(yarn lerna ll -p | grep ":sourcecred:" | cut --delimiter ":" --fields=1)"
