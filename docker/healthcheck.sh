#!/bin/sh
# Simple healthcheck script for Docker
set -e

URL="http://127.0.0.1:3000/api/health"

status=$(curl -s -o /dev/null -w "%{http_code}" "$URL" || true)
if [ "$status" = "200" ]; then
  exit 0
fi
exit 1
