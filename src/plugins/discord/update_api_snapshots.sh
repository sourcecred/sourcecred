#!/bin/bash

set -eu

snapshots_dir=src/plugins/discord/snapshots
discord_api=https://discordapp.com/api

if [ ! "$(jq --version)" ]; then
  printf >&2 'This script depends on jq. Please install it.\n'
  exit 1
fi

toplevel="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
cd "${toplevel}"

fetch() {
  url="${discord_api}$1"
  filename="$(printf '%s' "${url}" | base64 -w 0 | tr -d '=' | tr '/+' '_-')"
  path="${snapshots_dir}/${filename}"
  if [ -z "${SOURCECRED_DISCORD_TOKEN:-}" ]; then
    printf >&2 'Please set the SOURCECRED_DISCORD_TOKEN environment variable\n'
    return 1
  fi
  curl -sfL "$url" \
    -H "Accept: application/json" \
    -H "Authorization: Bot ${SOURCECRED_DISCORD_TOKEN}" \
    | jq '.' > "${path}"
}

rm -r "${snapshots_dir}"
mkdir "${snapshots_dir}"
fetch "/users/@me/guilds"
