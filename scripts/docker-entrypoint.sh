#!/bin/bash

if [ -z "${SOURCECRED_GITHUB_TOKEN}" ]; then
    echo "Export SOURCECRED_GITHUB_TOKEN with the container."
    echo 'SOURCECRED_GITHUB_TOKEN=xxxxxxxxxxx docker run --env SOURCECRED_GITHUB_TOKEN -p 8080:8080 sourcecred <repository>'
    exit 1;
fi

# serves on 8080 in docker container, should be bound to host
node /code/bin/sourcecred.js load "${@}"
yarn start --host 0.0.0.0
