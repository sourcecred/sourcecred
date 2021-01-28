#!/bin/bash
set -eu

# This script is now necessary since webpack-cli no longer accepts arbitrary
# flags.
# We now have to set an environment variable from the flag and then
# access that variable within the node process.

if [ $# -eq 2 ]; then
  if [ $1 == "--instance" ]; then
    export INSTANCE=$2
  else
    ERR="WARN: unexpected input enountered: $1; expected --instance\nServing default instance"
    echo -e $ERR >&2
  fi
fi

NODE_ENV=development webpack serve --config config/webpack.config.web.js
