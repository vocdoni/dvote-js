#!/bin/bash

set -e

PRE_BUILD_PACKAGES_ORDERED=('common' 'contract-wrappers' 'encryption' 'signing' 'hashing' 'data-models')
PACKAGES=$(find ./packages -type d -maxdepth 1 -mindepth 1)

###############################################################################

function install_deps {
  echo "Installing packages"
  npm install
}

function build_all {
  echo "Building subpackages"
  for d in ${PRE_BUILD_PACKAGES_ORDERED[@]}
  do
    echo "Prebuilding $d"
    cd ./packages/$d
    npm run build
    cd -
  done
}

function test_all {
  echo "Testing subpackages"
  for d in $PACKAGES
  do
    echo "Testing $d"
    cd $d
    npm run test
    cd -
  done
}

###############################################################################

install_deps
build_all
test_all
