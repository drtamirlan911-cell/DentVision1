#!/usr/bin/env bash
# Installed over node_modules/.bin/prisma on postinstall.
# Refuses --accept-data-loss so Render Dashboard cannot wipe prod tables.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
REAL="$DIR/prisma.real"
if [[ ! -x "$REAL" ]]; then
  REAL="$DIR/../prisma/build/index.js"
  if [[ -f "$REAL" ]]; then
    ARGS=()
    for a in "$@"; do
      if [[ "$a" == "--accept-data-loss" ]]; then
        echo "[safe-prisma] Refusing --accept-data-loss (blocks destructive db push)" >&2
        continue
      fi
      ARGS+=("$a")
    done
    exec node "$REAL" "${ARGS[@]}"
  fi
  echo "[safe-prisma] prisma.real not found" >&2
  exit 1
fi
ARGS=()
for a in "$@"; do
  if [[ "$a" == "--accept-data-loss" ]]; then
    echo "[safe-prisma] Refusing --accept-data-loss (blocks destructive db push)" >&2
    continue
  fi
  ARGS+=("$a")
done
exec "$REAL" "${ARGS[@]}"
