#!/bin/bash

node libs/server.js & pid=$!
sleep 2
./node_modules/.bin/mocha
kill -SIGINT $pid