#!/bin/bash

set -e
CYAN="\e[36m"
ENDCOLOR="\e[0m"

# Add here any packages to be built (in order, otherwise will fail due to missing dependencies)
PRE_BUILD_PACKAGES_ORDERED=(
    'common'
    'contract-wrappers'
    'encryption'
    'signing'
    'hashing'
    'data-models'
    'client'
    'census'
    'voting'
    'wallets'
)

function print_task {
    echo -e $CYAN $1 $ENDCOLOR
}

function install_deps {
    print_task ": Installing packages"
    npm install
}

function build_all {
    print_task ": Building subpackages"
    for d in ${PRE_BUILD_PACKAGES_ORDERED[@]}
    do
        print_task ":: Building @vocdoni/$d"
        npm run build -w ./packages/$d
    done

    # build main repo too
    npm run clean
    tsc -b
}

install_deps
build_all
