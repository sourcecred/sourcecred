#!/bin/sh
VERSION=$(node -p -e "require('./package.json').version")
PACKAGE=$(node -p -e "require('./package.json').name")

yarn documentation build ${1} -f html -o ../../docs/$PACKAGE/$VERSION && \
  yarn documentation build -f html -g ${1} -o ../../docs/$PACKAGE/
