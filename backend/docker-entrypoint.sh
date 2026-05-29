#!/bin/sh
set -e

echo "Running database migrations..."
./node_modules/.bin/prisma migrate deploy

echo "Seeding super admin (skipped if already exists)..."
node seed-prod.js

echo "Starting application..."
exec "$@"
