#!/usr/bin/env bash
# One-time server setup for wa-service on Ubuntu 24.04 (Oracle Cloud Always Free or any VPS).
# Run from the wa-service folder:   sudo bash deploy/setup.sh [domain]
#   domain: optional, e.g. wa.yourshop.com (its DNS must point to this server).
#           Without it, <public-ip>.sslip.io is used, which also gets a real HTTPS certificate.
# Safe to run again: it only adds what is missing, then rebuilds and restarts the service.
set -euo pipefail

cd "$(dirname "$0")/.."
[ "$(id -u)" -eq 0 ] || { echo "Run with sudo: sudo bash deploy/setup.sh"; exit 1; }

say() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }

# ── .env check ──
[ -f .env ] || { echo ".env is missing. Copy .env.example to .env and fill it in."; exit 1; }
for key in WA_API_SECRET WA_WEBHOOK_SECRET WA_WEBHOOK_URL; do
  val=$(grep -E "^${key}=" .env | tail -n1 | cut -d= -f2- || true)
  [ -n "$val" ] || { echo ".env: $key is empty"; exit 1; }
done
if grep -qE '^WA_WEBHOOK_URL=.*(localhost|127\.0\.0\.1|host\.docker\.internal)' .env; then
  echo ".env: WA_WEBHOOK_URL still points to the laptop. Set it to https://<your-vercel-app>/api/whatsapp/webhook"
  exit 1
fi

# ── Swap (the 1 GB server needs it to build the Go code) ──
if ! swapon --show | grep -q .; then
  say "Adding 2 GB swap"
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# ── Docker ──
if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
  say "Installing Docker"
  apt-get update -y
  DEBIAN_FRONTEND=noninteractive apt-get install -y docker.io docker-compose-v2
  systemctl enable --now docker
fi
[ -n "${SUDO_USER:-}" ] && usermod -aG docker "$SUDO_USER" || true

# ── Firewall: Oracle's Ubuntu image blocks everything except SSH inside the server too ──
say "Opening ports 80 and 443"
for p in 80 443; do
  iptables -C INPUT -p tcp --dport "$p" -m state --state NEW -j ACCEPT 2>/dev/null \
    || iptables -I INPUT 5 -p tcp --dport "$p" -m state --state NEW -j ACCEPT
done
if command -v netfilter-persistent >/dev/null; then
  netfilter-persistent save >/dev/null
else
  DEBIAN_FRONTEND=noninteractive apt-get install -y iptables-persistent >/dev/null && netfilter-persistent save >/dev/null
fi

# ── Domain ──
DOMAIN="${1:-}"
if [ -z "$DOMAIN" ] && [ -f deploy/.domain ]; then DOMAIN=$(cat deploy/.domain); fi
if [ -z "$DOMAIN" ]; then
  IP=$(curl -fsS https://api.ipify.org || curl -fsS https://ifconfig.me)
  DOMAIN="${IP}.sslip.io"
fi
echo "$DOMAIN" > deploy/.domain
# docker compose reads deploy/.env by itself, so a plain "docker compose ... up" later knows the domain too
echo "DOMAIN=$DOMAIN" > deploy/.env
export DOMAIN

# ── Build and start ──
say "Building and starting wa-service + Caddy for https://$DOMAIN (first build takes a few minutes)"
docker compose -f deploy/docker-compose.prod.yml up -d --build

say "Waiting for the service"
for _ in $(seq 1 30); do
  curl -fsS http://127.0.0.1:8080/healthz >/dev/null 2>&1 && break
  sleep 2
done
docker compose -f deploy/docker-compose.prod.yml ps

cat <<EOF

Done. wa-service URL:  https://$DOMAIN

In Vercel (Project → Settings → Environment Variables) set:
  WA_SERVICE_URL     = https://$DOMAIN
  WA_API_SECRET      = (same as WA_API_SECRET in this .env)
  WA_WEBHOOK_SECRET  = (same as WA_WEBHOOK_SECRET in this .env)
then redeploy, open the WhatsApp page and scan the QR.

Useful:
  logs:     docker compose -f deploy/docker-compose.prod.yml logs -f wa-service
  restart:  docker compose -f deploy/docker-compose.prod.yml restart wa-service
  update:   (copy the new code) then  sudo bash deploy/setup.sh
EOF
