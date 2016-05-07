#!/bin/bash

node server.js & pid=$!
sleep 5
./node_modules/.bin/mocha
OUT=$?
kill -SIGINT $pid
exit $OUT