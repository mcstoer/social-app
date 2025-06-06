#!/bin/bash

# Run the main web app
echo "Starting main web app..."
yarn web &
WEB_PID=$!

# Run vskylogin server
echo "Starting vskylogin server..."
cd vskylogin
yarn dev &
LOGIN_PID=$!
cd ..

# Run vskysigningserver
echo "Starting vskysigningserver..."
cd vskysigningserver
yarn dev &
SIGNING_PID=$!
cd ..

# Wait for all processes to complete
wait $WEB_PID $LOGIN_PID $SIGNING_PID

# Cleanup on exit
trap "kill $WEB_PID $LOGIN_PID $SIGNING_PID 2> /dev/null" EXIT 