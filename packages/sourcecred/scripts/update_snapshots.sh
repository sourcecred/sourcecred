#!/bin/sh

# Automatically update SourceCred snapshot data.
# This deliberately does not update Discourse API snapshots,
# because they are very noisy. If you want to update Discourse
# snapshots, run ./src/plugins/discourse/update_discourse_api_snapshots.sh

set -eu

toplevel="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)/packages/sourcecred"
cd "${toplevel}"

tmpdir="$(mktemp -d)"
cleanup() {
    rm -r "${tmpdir}"
}
trap cleanup EXIT

SOURCECRED_BIN="${tmpdir}/bin"
yarn run --silent build:backend --output-path "${SOURCECRED_BIN}"
export SOURCECRED_BIN  # for Sharness and shell tests
export NODE_PATH="${toplevel}/node_modules${NODE_PATH:+:${NODE_PATH}}"

echo "Updating GitHub GraphQL Flow types"
cp .prettierrc.json "${SOURCECRED_BIN}/"
node "${SOURCECRED_BIN}/generateGithubGraphqlFlowTypes.js" \
    >src/plugins/github/graphqlTypes.js

echo "Updating sharness/test_load_example_github.t"
(cd sharness; UPDATE_SNAPSHOT=1 ./load_test_instance.t -l)

echo "Updating github/fetchGithubOrgTest.sh"
./src/plugins/github/fetchGithubOrgTest.sh -u --no-build

echo "Updating github/fetchGithubRepoTest.sh"
./src/plugins/github/fetchGithubRepoTest.sh -u --no-build

echo "Updating Jest snapshots"
yarn unit -u
