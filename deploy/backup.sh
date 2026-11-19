#!/usr/bin/env bash
# Sichert alle Runden (Saldo, Verlauf, Ruhmeshalle) nach ./backups/.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p backups
file="backups/runden-$(date +%Y-%m-%d_%H%M).tar.gz"
docker compose exec -T app tar -C /data -czf - . > "$file"
# nur die letzten 30 Sicherungen behalten
ls -1t backups/runden-*.tar.gz | tail -n +31 | xargs -r rm --
echo "Gesichert: $file"
