#!/bin/sh
set -eu
BACKUP_DIR=/var/backups/terracusto
install -d -m 0700 -o postgres -g postgres "$BACKUP_DIR"
runuser -u postgres -- pg_dump --format=custom --file="$BACKUP_DIR/terracusto-$(date +%Y%m%d-%H%M%S).dump" terracusto
find "$BACKUP_DIR" -type f -name 'terracusto-*.dump' -mtime +14 -delete
