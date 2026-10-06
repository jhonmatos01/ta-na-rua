#!/bin/sh
set -eu

cd /app
node dist/database/migrate.js
if [ "${PILOT_BOOTSTRAP:-false}" = "true" ]; then
  node dist/database/bootstrap-pilot.js
fi
exec node dist/server.js
