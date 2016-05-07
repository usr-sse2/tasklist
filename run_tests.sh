#!/bin/bash

node server.js & pid=$!
sleep 5
./node_modules/.bin/mocha
kill -SIGINT $pid