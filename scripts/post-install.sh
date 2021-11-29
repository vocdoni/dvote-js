#!/bin/bash

for PKG in $(ls packages)
do
    echo "Running npm install on packages/$PKG"
    cd packages/$PKG
    npm install
    cd -
done
