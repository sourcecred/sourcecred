#!/bin/sh

# Automatically update all SourceCred snapshot data.
set -eu

toplevel="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
cd "${toplevel}"

yarn backend
echo "Updating GitHub graphql flow types"
node ./bin/generateGithubGraphqlFlowTypes.js > src/plugins/github/graphqlTypes.js
echo "Updating for sharness/test_load_example_github.t"
(cd sharness; UPDATE_SNAPSHOT=1 ./test_load_example_github.t -l)
echo "Updating git/loadRepositoryTest.sh"
./src/plugins/git/loadRepositoryTest.sh -u
echo "Updating github/fetchGithubOrgTest.sh"
./src/plugins/github/fetchGithubOrgTest.sh -u --no-build
echo "Updating github/fetchGithubRepoTest.sh"
./src/plugins/github/fetchGithubRepoTest.sh -u --no-build
echo "Updating Jest snapshots"
yarn unit -u
