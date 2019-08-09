#!/bin/sh
set -eu

main() {
    cd "$(dirname "$0")"
    rm -rf rasterized
    mkdir rasterized
    for size in 1024 512 256 128 64 32 16; do
        rasterize logo "${size}"
    done
}

# rasterize BASENAME SIZE
rasterize() {
    basename=$1
    size=$2
    inkscape -z "`pwd`/${basename}.svg" -e "`pwd`/rasterized/${basename}_${size}.png" \
        -w "${size}" -h "${size}"
}

main "$@"
