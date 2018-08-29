#!/bin/sh
set -eu

main() {
    cd "$(dirname "$0")"
    for size in 1024 512 256 128 64 32 16; do
        rasterize sourcecred "${size}"
        rasterize credbot "${size}"
        rasterize discourse "${size}"
    done
}

# rasterize BASENAME SIZE
rasterize() {
    basename=$1
    size=$2
    inkscape -z "./${basename}.svg" -e "./${basename}_${size}.png" \
        -w "${size}" -h "${size}"
}

main "$@"
