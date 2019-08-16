#!/bin/bash

case "$1" in
	# Offer a shortcut for load + dev-server
	"dev-preview")
		shift
		node /code/bin/sourcecred.js load "$@" || exit 1
		exec yarn -s start --host 0.0.0.0
		;;
	# Expose several webpack operations
	"dev-server")
		exec yarn -s start --host 0.0.0.0
		;;
	"build")
		shift
		exec yarn -s build "$@"
		;;
	# Everything else, pass on to sourcecred.js
	*)
		exec node /code/bin/sourcecred.js "$@"
		;;
esac
