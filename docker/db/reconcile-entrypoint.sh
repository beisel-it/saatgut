#!/bin/sh
set -eu

forward_term() {
  if [ -n "${postgres_pid:-}" ]; then
    kill -TERM "$postgres_pid" 2>/dev/null || true
  fi
}

trap forward_term INT TERM

/usr/local/bin/docker-entrypoint.sh postgres &
postgres_pid=$!

db_user="${POSTGRES_USER:-postgres}"
db_name="${POSTGRES_DB:-postgres}"
db_password="${POSTGRES_PASSWORD:-postgres}"

until pg_isready -h 127.0.0.1 -U "$db_user" -d "$db_name" >/dev/null 2>&1; do
  if ! kill -0 "$postgres_pid" 2>/dev/null; then
    wait "$postgres_pid"
    exit 1
  fi
  sleep 1
done

escaped_password=$(printf "%s" "$db_password" | sed "s/'/''/g")
psql -v ON_ERROR_STOP=1 -U "$db_user" -d "$db_name" <<SQL
ALTER USER "$db_user" WITH PASSWORD '$escaped_password';
SQL

wait "$postgres_pid"
