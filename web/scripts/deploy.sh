#!/usr/bin/env bash
set -euo pipefail

: "${DEPLOY_HOST:?Set DEPLOY_HOST, for example ubuntu@your-server}"
: "${DEPLOY_PATH:?Set DEPLOY_PATH, for example /home/ubuntu/web-staging}"
: "${DEPLOY_IR_DOMAIN:?Set DEPLOY_IR_DOMAIN}"
: "${DEPLOY_COM_DOMAIN:?Set DEPLOY_COM_DOMAIN}"
: "${DEPLOY_SERVICE:=locationsari-web}"

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

(
  cd "$project_dir"
  tar \
    --exclude='.env' \
    --exclude='.next' \
    --exclude='node_modules' \
    --exclude='uploads' \
    -cf - .
) | ssh "$DEPLOY_HOST" "tar -C '$DEPLOY_PATH' -xf -"

ssh "$DEPLOY_HOST" "
  set -e
  cd '$DEPLOY_PATH'

  sudo systemctl stop '$DEPLOY_SERVICE'
  npm run migrate
  NODE_OPTIONS=--max-old-space-size=2048 npm run build
  sudo systemctl start '$DEPLOY_SERVICE'

  for _ in \$(seq 1 40); do
    curl -fsS -o /dev/null http://127.0.0.1:4100/ && break
    sleep 0.5
  done
"

for domain in "$DEPLOY_IR_DOMAIN" "$DEPLOY_COM_DOMAIN"; do
  status="$(curl --fail --silent --show-error --output /dev/null --write-out '%{http_code}' "https://$domain/")"
  if [ "$status" != "200" ]; then
    printf 'Deployment verification failed for %s: HTTP %s\n' "$domain" "$status" >&2
    exit 1
  fi
done

printf 'Deployment verified for %s and %s.\n' "$DEPLOY_IR_DOMAIN" "$DEPLOY_COM_DOMAIN"
