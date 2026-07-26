#!/bin/sh
set -eu

: "${DATABASE_URL:=file:/data/tipoff.db}"
export DATABASE_URL

case "$DATABASE_URL" in
  file:*)
    db_path=$(printf '%s' "$DATABASE_URL" | sed 's/^file://')
    mkdir -p "$(dirname "$db_path")"
    ;;
esac

cd /app
npm run migrate -w db

exec npm run start -w frontend
