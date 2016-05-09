#!/bin/bash

# --report lcovonly
./node_modules/.bin/istanbul cover ./node_modules/mocha/bin/_mocha -- -R spec && cat ./coverage/lcov.info | ./node_modules/.bin/codecov
OUT=$?
exit $OUT