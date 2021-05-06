#!/bin/sh

test_description="trivial test file so that prove(1) doesn't give up"

. ./sharness.sh

test_expect_success "should trivially pass" true

test_done

# vim: ft=sh
