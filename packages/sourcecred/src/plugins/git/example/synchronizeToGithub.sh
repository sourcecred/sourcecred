#!/bin/bash

set -eu

main() {
    if [ "${1:-}" = "-n" ] || [ "${1:-}" = "--dry-run" ]; then
        DRY_RUN=1
    fi
    cd "$(git rev-parse --show-toplevel)"
    yarn build:backend
    printf '\n'
    printf 'Synchronizing: example-git\n'
    synchronize \
        --no-submodule 'git@github.com:sourcecred-test/example-git.git'
    printf '\n'
    printf 'Synchronizing: example-git-submodule\n'
    synchronize \
        --submodule 'git@github.com:sourcecred-test/example-git-submodule.git'
    printf '\n'
    printf 'Done.\n'
}

synchronize() (
    submodule_flag="$1"  # --submodule | --no-submodule
    remote_url="$2"
    tmpdir="$(mktemp -d)"
    node bin/createExampleRepo.js "${submodule_flag}" "${tmpdir}"
    (
        cd "${tmpdir}"
        git remote add upstream "${remote_url}"
        git fetch upstream --quiet
        args=( git push --force-with-lease upstream HEAD:master )
        if [ -n "${DRY_RUN:-}" ]; then
            args+=( --dry-run )
        fi
        "${args[@]}"
    )
    rm -rf "${tmpdir}"
)

main "$@"
