#!/bin/bash

node server.js & pid=$!
sleep 2
./node_modules/.bin/mocha
OUT=$?
kill -SIGINT $pid
exit $OUT