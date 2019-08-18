#!/bin/bash

set -eu

snapshots_dir=src/plugins/discourse/snapshots
test_instance_url="https://sourcecred-test.discourse.group"
test_instance_username="credbot"

if [ -z "${DISCOURSE_TEST_API_KEY:-}" ]; then
  printf >&2 'Please set the DISCOURSE_TEST_API_KEY environment variable.\n'
  printf >&2 'Contact the SourceCred maintainers to get the key.\n'
  exit 1
fi

if [ ! "$(jq --version)" ]; then
  printf >&2 'This script depends on jq. Please install it.\n'
  exit 1
fi

toplevel="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
cd "${toplevel}"

fetch() {
  url="${test_instance_url}$1"
  filename="$(printf '%s' "${url}" | base64 -w 0 | tr -d '=' | tr '/+' '_-')"
  path="${snapshots_dir}/${filename}"
  curl -sfL "$url" \
    -H "Api-Key: ${DISCOURSE_TEST_API_KEY}" \
    -H "Api-Username: ${test_instance_username}" \
    -H "Accept: application/json" \
    | jq '.' > "${path}"
}

rm -r "${snapshots_dir}"
mkdir "${snapshots_dir}"
fetch "/latest.json?order=created"
fetch "/posts.json"
fetch "/t/11.json"
fetch "/posts/14.json"
fetch "/user_actions.json?username=dl-proto&filter=1&offset=0"
