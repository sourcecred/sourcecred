#!/bin/sh
# shellcheck disable=SC2016
#
# Components must use the `Link` component from `webutil/Link.js` rather
# than raw `<a>` elements. The `Link` component properly handles
# client-side routing, as well as providing consistent styles.
#
# See <https://github.com/sourcecred/sourcecred/pull/1305> for an
# example of how to fix this error.

export GIT_CONFIG_NOSYSTEM=1
export GIT_ATTR_NOSYSTEM=1

# shellcheck disable=SC2034
test_description='check that bare <a> elements are never directly used'

# shellcheck disable=SC1091
. ./sharness.sh

# shellcheck disable=SC1004
test_expect_success "application components must use <Link> instead of <a>" '
    test_must_fail git grep -nF "</a>" -- \
        ":/src/*.js" \
        ":(exclude,top)*/__snapshots__/*" \
        ":(exclude,top)*/snapshots/*" \
        ":(exclude,top)src/plugins/discourse/references.test.js" \
        ":(exclude,top)src/plugins/discourse/createGraph.test.js" \
        ":(exclude,top)src/plugins/discourse/nodesAndEdges.test.js" \
        ":(exclude,top)src/plugins/initiatives/htmlTemplate.test.js" \
        ":(exclude,top)src/webutil/Link.js" \
        ;
'

test_done

# vim: ft=sh
