#!/bin/bash

# serves on 8080 in docker container, should be bound to host
node /code/bin/sourcecred.js "${@}" || exit 1
exec yarn start --host 0.0.0.0
