#!/bin/sh
set -eu

main() {
    cd "$(dirname "$0")"
    for size in 1024 512 256 128 64 32 16; do
        rasterize "${size}"
    done
}

# rasterize SIZE
rasterize() {
    size=$1
    inkscape -z ./sourcecred.svg -e "./sourcecred_${size}.png" \
        -w "${size}" -h "${size}"
}

main "$@"
