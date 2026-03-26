#!/usr/bin/env bash
set -euo pipefail

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_dir="${BACKUP_DIR:-backups}"
mkdir -p "$backup_dir"

if [[ -n "${DATABASE_URL:-}" ]]; then
  output_path="${backup_dir}/postgres-${timestamp}.sql"
  pg_dump "$DATABASE_URL" --clean --if-exists --no-owner --no-privileges > "$output_path"
  printf 'Wrote database backup to %s\n' "$output_path"
  exit 0
fi

if command -v docker >/dev/null 2>&1; then
  output_path="${backup_dir}/postgres-${timestamp}.sql"
  docker compose exec -T db pg_dump -U "${POSTGRES_USER:-postgres}" "${POSTGRES_DB:-saatgut}" \
    --clean --if-exists --no-owner --no-privileges > "$output_path"
  printf 'Wrote database backup to %s\n' "$output_path"
  exit 0
fi

printf 'DATABASE_URL is not set and docker compose is unavailable.\n' >&2
exit 1
