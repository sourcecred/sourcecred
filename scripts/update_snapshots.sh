#!/bin/sh

# Automatically update all SourceCred snapshot data.
set -eu

toplevel="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
cd "${toplevel}"

tmpdir="$(mktemp -d)"
cleanup() {
    rm -r "${tmpdir}"
}
trap cleanup EXIT

SOURCECRED_BIN="${tmpdir}/bin"
yarn run --silent backend --output-path "${SOURCECRED_BIN}"
export SOURCECRED_BIN  # for Sharness and shell tests
export NODE_PATH="${toplevel}/node_modules${NODE_PATH:+:${NODE_PATH}}"

echo "Updating GitHub GraphQL Flow types"
cp .prettierrc.json "${SOURCECRED_BIN}/"
node "${SOURCECRED_BIN}/generateGithubGraphqlFlowTypes.js" \
    >src/plugins/github/graphqlTypes.js

echo "Updating sharness/test_load_example_github.t"
(cd sharness; UPDATE_SNAPSHOT=1 ./test_load_example_github.t -l)

echo "Updating sharness/test_cli_scores.t"
(cd sharness; UPDATE_SNAPSHOT=1 ./test_cli_scores.t -l)

echo "Updating github/fetchGithubOrgTest.sh"
./src/plugins/github/fetchGithubOrgTest.sh -u --no-build

echo "Updating github/fetchGithubRepoTest.sh"
./src/plugins/github/fetchGithubRepoTest.sh -u --no-build

if [ -z "${DISCOURSE_TEST_API_KEY:-}" ]; then
  echo "Updating Discourse API snapshots"
  ./src/plugins/discourse/update_discourse_api_snapshots.sh
else
  echo "Not updating Discourse API snapshots (need DISCOURSE_TEST_API_KEY)"
fi

echo "Updating Jest snapshots"
yarn unit -u
