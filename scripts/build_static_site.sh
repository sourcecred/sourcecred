#!/bin/bash
set -eu

usage() {
    printf 'usage: build_static_site.sh --target TARGET\n'
    printf '                            [--repo OWNER/NAME [...]]\n'
    printf '                            [--cname DOMAIN]\n'
    printf '                            [-h|--help]\n'
    printf '\n'
    printf 'Build the static SourceCred website, including example data.\n'
    printf '\n'
    printf '%s\n' '--target TARGET'
    printf '\t%s\n' 'an empty directory into which to build the site'
    printf '%s\n' '--repo OWNER/NAME'
    printf '\t%s\n' 'a GitHub repository (e.g., torvalds/linux) for which'
    printf '\t%s\n' 'to include example data'
    printf '%s\n' '--cname DOMAIN'
    printf '\t%s\n' 'configure DNS for a GitHub Pages site to point to'
    printf '\t%s\n' 'the provided custom domain'
    printf '%s\n' '-h|--help'
    printf '\t%s\n' 'show this message'
}

main() {
    parse_args "$@"

    toplevel="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
    cd "${toplevel}"

    sourcecred_data=
    trap cleanup EXIT

    build
}

parse_args() {
    target=
    cname=
    repos=( )
    while [ $# -gt 0 ]; do
        case "$1" in
            --target)
                if [ -n "${target}" ]; then
                    die '--target specified multiple times'
                fi
                shift
                if [ $# -eq 0 ]; then die 'missing value for --target'; fi
                if ! target="$(readlink -e "$1")"; then
                    die "target does not exist: $1"
                fi
                ;;
            --repo)
                shift
                if [ $# -eq 0 ]; then die 'missing value for --repo'; fi
                repos+=( "$1" )
                ;;
            --cname)
                shift
                if [ $# -eq 0 ]; then die 'missing value for --cname'; fi
                if [ -n "${cname}" ]; then
                    die '--cname specified multiple times'
                fi
                cname="$1"
                if [ -z "${cname}" ]; then
                    die 'empty value for --cname'
                fi
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                printf >&2 'fatal: unknown argument: %s\n' "$1"
                exit 1
                ;;
        esac
        shift
    done
    if [ -z "${target}" ]; then
        die 'target directory not specified'
    fi
    if ! [ -d "${target}" ]; then
        die "target is not a directory: ${target}"
    fi
    if [ "$(command ls -A "${target}" | wc -l)" != 0 ]; then
        die "target directory is nonempty: ${target}"
    fi
}

build() {
    sourcecred_data="$(mktemp -d --suffix ".sourcecred-data")"
    export SOURCECRED_DIRECTORY="${sourcecred_data}"

    yarn
    # shellcheck disable=SC2016
    printf >&2 'warn: running `yarn backend`, overwriting `bin/` in your repo\n'
    printf >&2 'warn: if this offends you, please see: %s\n' \
        'https://github.com/sourcecred/sourcecred/issues/580'
    yarn backend
    yarn build --output-path "${target}"

    if [ "${#repos[@]}" -ne 0 ]; then
        for repo in "${repos[@]}"; do
            printf >&2 'info: loading repository: %s\n' "${repo}"
            node ./bin/sourcecred.js load "${repo}"
        done
    fi

    # Copy the SourceCred data into the appropriate API route. Using
    # `mkdir` here will fail in the case where an `api/` folder exists,
    # which is the correct behavior. (In this case, our site's
    # architecture conflicts with the required static structure, and we
    # must fail.)
    mkdir "${target}/api/"
    mkdir "${target}/api/v1/"
    # Eliminate the cache, which is only an intermediate target used to
    # load the actual data. The development server similarly forbids
    # access to the cache so that the dev and prod environments have the
    # same semantics.
    rm -rf "${sourcecred_data}/cache"
    cp -r "${sourcecred_data}" "${target}/api/v1/data"

    if [ -n "${cname:-}" ]; then
        cname_file="${target}/CNAME"
        if [ -e "${cname_file}" ]; then
            die 'CNAME file exists in static site output'
        fi
        printf '%s' "${cname}" >"${cname_file}"  # no newline
    fi
}

cleanup() {
    if [ -d "${sourcecred_data}" ]; then rm -rf "${sourcecred_data}"; fi
}

die() {
    printf >&2 'fatal: %s\n' "$@"
    exit 1
}

main "$@"
