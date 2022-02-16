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

if [ -z "${SOURCECRED_TEST_SERVER_TOKEN:-}" ]; then
  printf >&2 "Please set the SOURCECRED_TEST_SERVER_TOKEN environment variable.\n"
  exit 1
fi

cd "${CORE_PATH}"

fetch() {
  url="${test_instance_url}$1"
  filename="$(printf '%s' "${url}" | shasum -a 256 | cut -d' ' -f1)"
  path="${snapshots_dir}/${filename}"
  curl -sfL "$url" \
    -H "Accept: application/json" \
    -H "Authorization: Bot ${SOURCECRED_TEST_SERVER_TOKEN}" \
    | jq '.' > "${path}"
}

GUILD_ID="678348980639498428"
CHANNEL_ID="678394406507905129"
MESSAGE_ID="678394436757094410"
EMOJI_ID="678399364418502669"
EMOJI_NAME="sourcecred"
rm -r "${snapshots_dir}"
mkdir "${snapshots_dir}"
fetch "/users/@me/guilds"
fetch "/guilds/$GUILD_ID"
fetch "/guilds/$GUILD_ID/channels"
fetch "/guilds/$GUILD_ID/roles"
fetch "/guilds/$GUILD_ID/emojis"
fetch "/guilds/$GUILD_ID/members?after=0&limit=1000"
fetch "/channels/$CHANNEL_ID/messages?limit=10"
fetch "/channels/$CHANNEL_ID/messages?before=678394455849566208&limit=10"
fetch "/channels/$CHANNEL_ID/messages/$MESSAGE_ID/reactions/$EMOJI_NAME:$EMOJI_ID?after=0&limit=100"
