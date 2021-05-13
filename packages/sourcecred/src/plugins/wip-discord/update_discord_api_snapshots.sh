#!/bin/bash

set -eu

snapshots_dir=src/plugins/discord/snapshots
test_instance_url="https://discordapp.com/api"

toplevel="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"

. $toplevel/scripts/monorepo_vars.sh


if [ ! "$(jq --version)" ]; then
  printf >&2 'This script depends on jq. Please install it.\n'
  exit 1
fi

if [ -z "${SOURCECRED_DISCORD_BOT_TOKEN:-}" ]; then
  printf >&2 "Please set the SOURCECRED_DISCORD_TOKEN environment variable.\n"
  exit 1
fi



cd "${CORE_SUBPATH}"

fetch() {
  url="${test_instance_url}$1"
  filename="$(printf '%s' "${url}" | base64 -w 0 | tr -d '=' | tr '/+' '_-')"
  path="${snapshots_dir}/${filename}"
  curl -sfL "$url" \
    -H "Accept: application/json" \
    -H "Authorization: Bot ${SOURCECRED_DISCORD_BOT_TOKEN}" \
    | jq '.' > "${path}"
}

rm -r "${snapshots_dir}"
mkdir "${snapshots_dir}"
fetch "/guilds/678348980639498428"
fetch "/guilds/678348980639498428/channels"
fetch "/guilds/678348980639498428/members?after=0&limit=10"
fetch "/channels/678348980849213472/messages?after=0&limit=5"
fetch "/channels/678394406507905129/messages?after=0&limit=5"
fetch "/channels/678394406507905129/messages?after=678394436757094410&limit=5"
fetch "/channels/678394406507905129/messages?after=678394455849566208&limit=5"
fetch "/channels/678394406507905129/messages/678394436757094410/reactions/sourcecred:678399364418502669?after=0&limit=5"
