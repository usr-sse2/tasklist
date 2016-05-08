#!/bin/bash

node server.js & pid=$!
sleep 2
./node_modules/.bin/istanbul cover ./node_modules/mocha/bin/_mocha -- -R spec && cat ./coverage/lcov.info | ./node_modules/.bin/codecov
#./node_modules/.bin/mocha
OUT=$?
kill -SIGINT $pid
exit $OUT