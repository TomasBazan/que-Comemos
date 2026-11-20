#!/usr/bin/env bash
# Aplica en Supabase (producción) las migraciones de supabase/migrations que falten,
# usando la Management API (solo necesita SUPABASE_ACCESS_TOKEN).
# Registra lo aplicado en supabase_migrations.schema_migrations, compatible con la CLI.
#
# Uso: scripts/db-apply.sh            aplica las pendientes
#      scripts/db-apply.sh --status   muestra aplicadas/pendientes
#      scripts/db-apply.sh --sql "select 1"   ejecuta SQL suelto
set -euo pipefail

ENV_FILE="${QUECOMEMOS_ENV:-$HOME/.config/quecomemos/env}"
set -a; . "$ENV_FILE"; set +a
REF=$(echo "$SUPABASE_PROJECT_REF" | sed -E 's#https?://##; s#\.supabase\.co.*##; s#.*/project/##; s#/.*##')
ROOT=$(cd "$(dirname "$0")/.." && pwd)

run_sql() {
  local body resp
  body=$(jq -Rs '{query: .}')
  resp=$(curl -sS -w '\n%{http_code}' -X POST \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H 'Content-Type: application/json' \
    "https://api.supabase.com/v1/projects/$REF/database/query" --data "$body")
  local code=${resp##*$'\n'}
  local out=${resp%$'\n'*}
  if [[ "$code" != 2* ]]; then
    echo "ERROR ($code): $out" >&2
    return 1
  fi
  echo "$out"
}

if [[ "${1:-}" == "--sql" ]]; then
  printf '%s' "$2" | run_sql
  exit
fi

printf '%s' "create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key, statements text[], name text);" | run_sql >/dev/null

applied=$(printf '%s' "select coalesce(json_agg(version), '[]') as v from supabase_migrations.schema_migrations" \
  | run_sql | jq -r '.[0].v[]')

for f in "$ROOT"/supabase/migrations/*.sql; do
  base=$(basename "$f" .sql)
  version=${base%%_*}
  name=${base#*_}
  if grep -qx "$version" <<<"$applied"; then
    [[ "${1:-}" == "--status" ]] && echo "aplicada   $base"
    continue
  fi
  if [[ "${1:-}" == "--status" ]]; then
    echo "PENDIENTE  $base"
    continue
  fi
  echo "Aplicando $base…"
  {
    echo "begin;"
    cat "$f"
    echo ";"
    echo "insert into supabase_migrations.schema_migrations (version, name) values ('$version', '$name');"
    echo "commit;"
  } | run_sql >/dev/null
  echo "  ok"
done
