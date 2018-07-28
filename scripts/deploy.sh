#!/bin/sh
set -eu

: "${SOURCECRED_REMOTE:=git@github.com:sourcecred/sourcecred.git}"
: "${SOURCECRED_REF:=origin/master}"

: "${DEPLOY_REMOTE:=git@github.com:sourcecred/sourcecred.github.io.git}"
: "${DEPLOY_BRANCH:=master}"
: "${DEPLOY_CNAME_URL:=sourcecred.io}"

export GIT_CONFIG_NOSYSTEM=1
export GIT_ATTR_NOSYSTEM=1

main() {
    parse_args "$@"

    toplevel="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
    cd "${toplevel}"

    sourcecred_repo=
    sourcecred_site=
    preview_dir=
    trap cleanup EXIT

    ensure_clean_working_tree
    build_and_deploy
}

parse_args() {
    while [ $# -gt 0 ]; do
        case "$1" in
            -n|--dry-run)
                printf 'Setting DRY_RUN=1.\n'
                DRY_RUN=1
                ;;
            *)
                printf >&2 'unknown argument: %s\n' "$1"
                exit 1
                ;;
        esac
        shift
    done
}

# Adapted from:
# https://github.com/git/git/blob/8d530c4d64ffcc853889f7b385f554d53db375ed/git-sh-setup.sh#L207-L222
ensure_clean_working_tree() {
    err=0
    if ! git diff-files --quiet --ignore-submodules; then
        printf >&2 'Cannot deploy: You have unstaged changes.\n'
        err=1
    fi
    if ! git diff-index --cached --quiet --ignore-submodules HEAD -- ; then
        if [ "${err}" -eq 0 ]; then
            printf >&2 'Cannot deploy: Your index contains uncommitted changes.\n'
        else
            printf >&2 'Additionally, your index contains uncommitted changes.\n'
        fi
        err=1
    fi
    if [ "${err}" -ne 0 ]; then
        exit "${err}"
    fi
}

build_and_deploy() {
    sourcecred_data="$(mktemp -d --suffix ".sourcecred-data")"
    export SOURCECRED_DIRECTORY="${sourcecred_data}"

    sourcecred_repo="$(mktemp -d --suffix ".sourcecred-repo")"
    git clone "${SOURCECRED_REMOTE}" "${sourcecred_repo}"
    sourcecred_hash="$(
        git -C "${sourcecred_repo}" rev-parse --verify "${SOURCECRED_REF}" --
    )"
    git -C "${sourcecred_repo}" checkout --detach "${sourcecred_hash}"
    (
        cd "${sourcecred_repo}"
        yarn
        yarn backend
        yarn build
        node ./bin/sourcecred.js load ipfs/js-ipfs
        node ./bin/sourcecred.js load sourcecred/sourcecred
    )

    sourcecred_site="$(mktemp -d --suffix ".sourcecred-site")"
    git clone "${DEPLOY_REMOTE}" "${sourcecred_site}"

    if ! base_commit="$(
            git -C "${sourcecred_site}" rev-parse --verify \
              "refs/remotes/origin/${DEPLOY_BRANCH}" --
    )"; then
        printf >&2 'No deploy branch %s.\n' "${DEPLOY_BRANCH}"
        exit 1
    fi
    git -C "${sourcecred_site}" checkout --detach "${base_commit}"
    rm "${sourcecred_site}/.git/index"
    git -C "${sourcecred_site}" clean -qfdx
    # Explode the `build/` directory into the current directory.
    find "${sourcecred_repo}/build/" -mindepth 1 -maxdepth 1 \
        \( -name .git -prune \) -o \
        -exec cp -r -t "${sourcecred_site}" -- {} +
    # Copy the SourceCred data into the appropriate API route.
    mkdir "${sourcecred_site}/api/"
    mkdir "${sourcecred_site}/api/v1/"
    cp -r "${sourcecred_data}" "${sourcecred_site}/api/v1/data"
    if [ -n "${DEPLOY_CNAME_URL}" ]; then
        if [ -e "${sourcecred_site}/CNAME" ]; then
            printf 'Error: CNAME file would be overwritten!\n' >&2
            exit 1
        fi
        printf '%s' "${DEPLOY_CNAME_URL}" >"${sourcecred_site}/CNAME"
    fi
    git -C "${sourcecred_site}" add --all .
    git -C "${sourcecred_site}" commit -m "deploy-v1: ${sourcecred_hash}"
    deploy_commit="$(git -C "${sourcecred_site}" rev-parse HEAD)"

    preview_dir="$(mktemp -d --suffix ".sourcecred-prvw")"
    git clone -q --no-local --no-checkout "${sourcecred_site}" "${preview_dir}"
    git -C "${preview_dir}" checkout -q --detach "${deploy_commit}"

    printf '\n'
    printf 'Please review the build output now---run:\n'
    printf '    cd "%s" && python -m SimpleHTTPServer\n' "${preview_dir}"
    line=
    while [ "${line}" != yes ] && [ "${line}" != no ]; do
        printf 'Do you want to deploy? yes/no> '
        read -r line
    done
    if [ "${line}" = yes ]; then
        (
            set -x;
            git -C "${sourcecred_site}" push ${DRY_RUN:+--dry-run} \
                origin \
                "${deploy_commit}:${DEPLOY_BRANCH}" \
                ;
        )
    else
        printf 'Aborting.\n'
    fi

    printf 'Done.\n'
}

cleanup() {
    if [ -d "${sourcecred_site}" ]; then
        rm -rf "${sourcecred_site}"
    fi
    if [ -d "${sourcecred_repo}" ]; then
        rm -rf "${sourcecred_repo}"
    fi
    if [ -d "${preview_dir}" ]; then
        rm -rf "${preview_dir}"
    fi
}

main "$@"
