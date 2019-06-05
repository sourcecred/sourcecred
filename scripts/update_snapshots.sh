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

echo "Updating git/loadRepositoryTest.sh"
./src/plugins/git/loadRepositoryTest.sh -u --no-build

echo "Updating github/fetchGithubOrgTest.sh"
./src/plugins/github/fetchGithubOrgTest.sh -u --no-build

echo "Updating github/fetchGithubRepoTest.sh"
./src/plugins/github/fetchGithubRepoTest.sh -u --no-build

echo "Updating Jest snapshots"
yarn unit -u
