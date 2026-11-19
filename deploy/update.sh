#!/usr/bin/env bash
# Neue Version holen und neu starten. Laufende Runden bleiben erhalten (Volume).
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
docker compose up -d --build
docker image prune -f >/dev/null
docker compose ps
