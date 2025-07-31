#!/bin/bash

# Run all processes concurrently to allow for hot reloading.
yarn concurrently \
  "yarn web" \
  "cd vskylogin && yarn dev" \
  "cd vskysigningserver && yarn dev" \
  --names "web,login,signing" \
  --prefix-colors "blue,green,yellow"