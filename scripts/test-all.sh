#!/bin/bash

set -e

SCRIPT_DIR=$(cd -- "$( dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)

source $SCRIPT_DIR/build-all.sh

function test_all {
    print_task ": Testing subpackages"
    for d in ${PRE_BUILD_PACKAGES_ORDERED[@]}
    do
        echo ":: Testing @vocdoni/$d"
        npm run test -w ./packages/$d
    done
}

test_all
