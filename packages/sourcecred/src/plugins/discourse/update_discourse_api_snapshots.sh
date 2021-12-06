#!/bin/bash

set -eu

snapshots_dir=src/plugins/discourse/snapshots
test_instance_url="https://sourcecred-test.discourse.group"

toplevel="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"

. $toplevel/scripts/monorepo_vars.sh

if [ ! "$(jq --version)" ]; then
  printf >&2 'This script depends on jq. Please install it.\n'
  exit 1
fi

cd "${CORE_PATH}"

fetch() {
  url="${test_instance_url}$1"
  filename="$(printf '%s' "${url}" | shasum -a 256 -U | cut -d' ' -f1)"
  path="${snapshots_dir}/${filename}"
  curl -sfL "$url" \
    -H "Accept: application/json" \
    | jq '.' > "${path}"
}

rm -r "${snapshots_dir}"
mkdir "${snapshots_dir}"
fetch "/latest.json?order=activity&ascending=false&page=0"
fetch "/latest.json?order=activity&ascending=false&page=1"
fetch "/categories.json?show_subcategory_list=true"
fetch "/categories.json?show_subcategory_list=true&parent_category_id=5"
fetch "/categories.json?show_subcategory_list=true&parent_category_id=1"
fetch "/categories.json?show_subcategory_list=true&parent_category_id=2"
fetch "/t/11.json"
fetch "/t/21.json"
fetch "/t/26.json"
fetch "/t/26.json?page=2"
fetch "/user_actions.json?username=dl-proto&filter=1&offset=0"
fetch "/users/dl-proto.json"
fetch "/users/system.json"
