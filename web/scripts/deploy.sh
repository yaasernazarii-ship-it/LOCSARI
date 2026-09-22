#!/usr/bin/env bash
set -euo pipefail

: "${DEPLOY_HOST:?Set DEPLOY_HOST, for example ubuntu@your-server}"
: "${DEPLOY_PATH:?Set DEPLOY_PATH, for example /home/ubuntu/web-staging}"
: "${DEPLOY_IR_DOMAIN:?Set DEPLOY_IR_DOMAIN}"
: "${DEPLOY_COM_DOMAIN:?Set DEPLOY_COM_DOMAIN}"

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

  # سرویس با PID ثبت‌شده متوقف می‌شود تا شِل اجرای deploy هرگز هدف kill قرار نگیرد.
  if [ -s .next-server.pid ]; then
    old_pid=\$(cat .next-server.pid)
    kill -TERM \"\$old_pid\" 2>/dev/null || true
    kill -TERM -- -\"\$old_pid\" 2>/dev/null || true
    for _ in \$(seq 1 20); do
      kill -0 \"\$old_pid\" 2>/dev/null || break
      sleep 0.5
    done
    kill -KILL \"\$old_pid\" 2>/dev/null || true
    kill -KILL -- -\"\$old_pid\" 2>/dev/null || true
    rm -f .next-server.pid
  fi

  npm run migrate
  NODE_OPTIONS=--max-old-space-size=2048 npm run build

  nohup setsid npm run start > next.log 2>&1 </dev/null &
  echo \$! > .next-server.pid

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
