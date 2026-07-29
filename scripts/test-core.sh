#!/usr/bin/env bash
set -euo pipefail
rm -rf build-core
tsc -p tsconfig.core.json
node --test test/core.test.mjs
