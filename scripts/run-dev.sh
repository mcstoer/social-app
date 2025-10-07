#!/bin/bash

# Run all processes concurrently to allow for hot reloading.
yarn concurrently \
  "yarn web" \
  "cd vskysigningserver && yarn dev" \
  --names "web,signing" \
  --prefix-colors "blue,yellow"