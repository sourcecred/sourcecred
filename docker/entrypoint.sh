#!/usr/bin/env bash
node bin/sourcecred.js load $@
exec yarn start
