#!/bin/sh

# Disable these lint rules globally:
#   2034 = unused variable (used by sharness)
#   2016 = parameter expansion in single quotes
#   1004 = backslash-newline in single quotes
# shellcheck disable=SC2034,SC2016,SC1004
:

test_description='tests for scripts/build_static_site.sh'

export GIT_CONFIG_NOSYSTEM=1
export GIT_ATTR_NOSYSTEM=1

# shellcheck disable=SC1091
. ./sharness.sh

run() (
    set -eu
    toplevel="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
    "${toplevel}"/scripts/build_static_site.sh "$@"
)

#
# Start by checking a bunch of easy cases related to the argument
# parser, mostly about rejecting various ill-formed invocations.

test_expect_success "should print a help message" '
    run --help >msg 2>err &&
    test_must_be_empty err &&
    test_path_is_file msg &&
    grep -qF "usage: build_static_site.sh" msg
'

test_expect_success "should fail with no target" '
    test_must_fail run 2>err &&
    grep -qF -- "target directory not specified" err
'

test_expect_success "should fail with missing target value" '
    test_must_fail run --target 2>err &&
    grep -qF -- "missing value for --target" err
'

test_expect_success "should fail with multiple targets" '
    mkdir one two &&
    test_must_fail run --target one --target two 2>err &&
    grep -qF -- "--target specified multiple times" err
'

test_expect_success "should fail with a file as target" '
    printf "important\nstuff" >important_data &&
    test_must_fail run --target important_data 2>err &&
    grep -qF -- "target is not a directory" err &&
    printf "important\nstuff" | test_cmp - important_data
'

test_expect_success "should fail with a target under a file" '
    printf "important\nstuff" >important_data &&
    test_must_fail run --target important_data/something 2>err &&
    grep -q -- "cannot create directory.*Not a directory" err &&
    printf "important\nstuff" | test_cmp - important_data
'

test_expect_success "should fail with a nonempty directory as target" '
    mkdir important_dir &&
    printf "redacted\n" >important_dir/.wallet.dat &&
    test_must_fail run --target important_dir 2>err &&
    grep -qF -- "target directory is nonempty: important_dir" err &&
    printf "redacted\n" | test_cmp - important_dir/.wallet.dat
'

mkdir putative_output

test_expect_success "should fail with missing repo value" '
    test_must_fail run --target putative_output --repo 2>err &&
    grep -qF -- "missing value for --repo" err &&
    printf "redacted\n" | test_cmp - important_dir/.wallet.dat
'

test_expect_success "should fail with missing feedback-url value" '
    test_must_fail run --target putative_output --feedback-url 2>err &&
    grep -qF -- "missing value for --feedback-url" err &&
    printf "redacted\n" | test_cmp - important_dir/.wallet.dat
'

test_expect_success "should fail with empty feedback-url" '
    test_must_fail run --target putative_output --feedback-url "" 2>err &&
    grep -qF -- "empty value for --feedback-url" err &&
    printf "redacted\n" | test_cmp - important_dir/.wallet.dat
'

test_expect_success "should fail with multiple feedback-url values" '
    test_must_fail run --target putative_output \
        --feedback-url a.com --feedback-url b.com 2>err &&
    grep -qF -- "--feedback-url specified multiple times" err &&
    printf "redacted\n" | test_cmp - important_dir/.wallet.dat
'

test_expect_success "should fail with missing cname value" '
    test_must_fail run --target putative_output --cname 2>err &&
    grep -qF -- "missing value for --cname" err &&
    printf "redacted\n" | test_cmp - important_dir/.wallet.dat
'

test_expect_success "should fail with empty cname" '
    test_must_fail run --target putative_output --cname "" 2>err &&
    grep -qF -- "empty value for --cname" err &&
    printf "redacted\n" | test_cmp - important_dir/.wallet.dat
'

test_expect_success "should fail with multiple cname values" '
    test_must_fail run --target putative_output \
        --cname a.com --cname b.com 2>err &&
    grep -qF -- "--cname specified multiple times" err &&
    printf "redacted\n" | test_cmp - important_dir/.wallet.dat
'

#
# Now, actually generate output in two cases: one with repositories, and
# one with no repositories. We can only do this if we have a token.

if [ -n "${SOURCECRED_GITHUB_TOKEN:-}" ]; then
    test_set_prereq HAVE_GITHUB_TOKEN
fi

# run_build PREREQ_NAME DESCRIPTION [FLAGS...]
# Build the site with the given FLAGS, and create a prereq PREREQ_NAME
# to be used in any tests that depend on this build. The build will
# itself have the EXPENSIVE prereq.
run_build() {
    prereq_name="$1"; shift
    description="$1"; shift
    output_dir="build_output/output_${prereq_name}"
    api_dir="${output_dir}/api/v1/data"
    data_dir="${api_dir}/data"
    unsafe_arg=
    for arg in "${output_dir}" "$@"; do
        unusual_chars="$(printf '%s' "$arg" | sed -e 's#[A-Za-z0-9:/_.-]##g')"
        if [ -n "${unusual_chars}" ]; then
            unsafe_arg="${arg}"
            break
        fi
    done
    flags="--target $output_dir $*"  # only used if ! [ -n "${unsafe_arg}" ]
    test_expect_success EXPENSIVE,HAVE_GITHUB_TOKEN \
        "${prereq_name}: ${description}" '
        if [ -n "${unsafe_arg}" ]; then
            printf >&2 "fatal: potentially unsafe argument: %s\n" "${arg}" &&
            false
        fi &&
        run '"${flags}"' 2>err &&
        test_must_fail grep -vF \
            -e "Removing build directory: " \
            -e "warn: running `yarn backend`" \
            -e "warn: if this offends you" \
            -e "info: loading repository" \
            err &&
        test_path_is_dir "${output_dir}" &&
        test_path_is_dir "${api_dir}" &&
        test_set_prereq "${prereq_name}"
    '
    test_expect_success "${prereq_name}" \
        "${prereq_name}: should have no cache" '
        test_must_fail test_path_is_dir "${api_dir}/cache"
    '
    test_expect_success "${prereq_name}" \
        "${prereq_name}: should have a bundle" '
        _js_bundles=( "${output_dir}"/static/js/main.*.js ) &&
        [ ${#_js_bundles[@]} -eq 1 ] &&
        js_bundle_path="${_js_bundles[0]}" &&
        test_path_is_file "${js_bundle_path}"
    '
}

# test_pages PREREQ_NAME
# Test that the PREREQ_NAME build output includes a valid home page, a
# valid prototype page, and a valid Discord invite page (which should be
# a redirect).
test_pages() {
    prereq="$1"
    test_expect_success "${prereq}" "${prereq}: should have a favicon" '
        test_path_is_file "${output_dir}/favicon.png" &&
        file -b --mime-type "${output_dir}/favicon.png" >./favicon_filetype &&
        printf "image/png\n" | test_cmp - ./favicon_filetype &&
        rm ./favicon_filetype
    '
    test_expect_success "${prereq}" \
        "${prereq}: should have a home page and a prototype" '
        test_path_is_file "${output_dir}/index.html" &&
        grep -qF "<script src=" "${output_dir}/index.html" &&
        test_path_is_file "${output_dir}/prototype/index.html" &&
        grep -qF "<script src=" "${output_dir}/prototype/index.html"
    '
    test_expect_success "${prereq}" \
        "${prereq}: should have a discord-invite with redirect" '
        file="${output_dir}/discord-invite/index.html" &&
        test_path_is_file "${file}" &&
        test_must_fail grep -qF "<script src=" "${file}" &&
        url="https://discord.gg/tsBTgc9" &&
        needle="<meta http-equiv=\"refresh\" content=\"0;url=$url\" />" &&
        grep -qxF "${needle}" "${file}"
    '
}

run_build TWO_REPOS \
    "should build the site with two repositories and a CNAME" \
    --cname sourcecred.example.com \
    --feedback-url http://discuss.example.com/feedback/ \
    --repo sourcecred/example-git \
    --repo sourcecred/example-github \
    ;

test_pages TWO_REPOS

test_expect_success TWO_REPOS \
    "TWO_REPOS: should have a registry with two repositories" '
    registry_file="${api_dir}/repositoryRegistry.json" &&
    test_path_is_file "${registry_file}" &&
    grep -oF "\"name\":" "${registry_file}" | wc -l >actual_count &&
    printf "2\n" | test_cmp - actual_count
'

test_expect_success TWO_REPOS \
    "TWO_REPOS: should have data for the two repositories" '
    for repo in sourcecred/example-git sourcecred/example-github; do
        for file in github/view.json.gz; do
            test -s "${data_dir}/${repo}/${file}" || return
        done
    done
'

test_expect_success TWO_REPOS \
    "TWO_REPOS: should include the feedback URL somewhere in the bundle" '
    grep -qF http://discuss.example.com/feedback/ "${js_bundle_path}"
'

test_expect_success TWO_REPOS "TWO_REPOS: should have a correct CNAME record" '
    test_path_is_file "${output_dir}/CNAME" &&
    printf "sourcecred.example.com" | test_cmp - "${output_dir}/CNAME"
'

# This feedback URL is "pollution" in the source environment and should
# _not_ be passed down to the actual application.
SOURCECRED_FEEDBACK_URL=http://wat.com/wat \
    run_build NO_REPOS \
    "should build the site with no repositories and no CNAME" \
    # no arguments here

test_pages NO_REPOS

test_expect_success NO_REPOS \
    "NO_REPOS: should not have a repository registry" '
    registry_file="${api_dir}/repositoryRegistry.json" &&
    test_must_fail test -e "${registry_file}"
'

test_expect_success NO_REPOS \
    "NO_REPOS: should not have repository data" '
    for repo in sourcecred/example-git sourcecred/example-github; do
        for file in git/graph.json github/view.json.gz; do
            test_must_fail test -f "${data_dir}/${repo}/${file}" || return
        done
    done
'

test_expect_success NO_REPOS \
    "NO_REPOS: should not include a feedback URL from a polluted environment" '
    test_must_fail grep -qF http://wat.com/wat "${js_bundle_path}"
'

test_expect_success NO_REPOS "NO_REPOS: should have no CNAME record" '
    test_must_fail test -e "${output_dir}/CNAME"
'

test_done

# vim: ft=sh
