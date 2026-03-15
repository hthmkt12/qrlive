#!/bin/bash
# Japan Proxy — Initial VPS Setup Script
# Run once on a fresh Tokyo VPS after cloning this repo
# Usage: bash setup.sh jp.company.com admin@company.com

set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"

if [[ -z "$DOMAIN" || -z "$EMAIL" ]]; then
  echo "Usage: $0 <domain> <email>"
  echo "  Example: $0 jp.company.com admin@company.com"
  exit 1
fi

echo "=== Japan Proxy Setup ==="
echo "Domain: $DOMAIN"
echo "Email:  $EMAIL"
echo

# --- 1. Install Docker ---
if ! command -v docker &>/dev/null; then
  echo "[1/5] Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
else
  echo "[1/5] Docker already installed, skipping."
fi

# --- 2. Firewall ---
echo "[2/5] Configuring firewall (ufw)..."
if command -v ufw &>/dev/null; then
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow 22/tcp   # SSH
  ufw allow 80/tcp   # HTTP (ACME + redirect)
  ufw allow 443/tcp  # HTTPS
  ufw --force enable
  echo "  Firewall enabled: 22, 80, 443 open"
else
  echo "  ufw not found — configure firewall manually (allow 22, 80, 443)"
fi

# --- 3. Create site config from template ---
echo "[3/5] Creating nginx site config for $DOMAIN..."
CONF_FILE="nginx/conf.d/proxy-${DOMAIN//./-}.conf"
if [[ -f "$CONF_FILE" ]]; then
  echo "  $CONF_FILE already exists, skipping."
else
  sed "s/jp\.company\.com/$DOMAIN/g" nginx/conf.d/proxy-template.conf > "$CONF_FILE"
  echo "  Created: $CONF_FILE"
  echo "  IMPORTANT: Edit $CONF_FILE and set the correct proxy_pass origin!"
fi

# --- 4. Get initial SSL certificate ---
echo "[4/5] Obtaining Let's Encrypt SSL certificate..."
echo "  Ensure DNS A record for $DOMAIN points to this server's IP before continuing."
read -r -p "  DNS propagated? Press Enter to continue..."

# Start nginx with HTTP-only config for ACME challenge
docker compose up -d nginx

# Request certificate
docker compose run --rm certbot certonly \
  --webroot \
  -w /var/www/certbot \
  -d "$DOMAIN" \
  --agree-tos \
  --email "$EMAIL" \
  --non-interactive

echo "  Certificate obtained for $DOMAIN"

# --- 5. Restart nginx with SSL ---
echo "[5/5] Restarting nginx with SSL..."
docker compose restart nginx
docker compose up -d

echo
echo "=== Setup Complete ==="
echo "  Health check: curl -sf https://$DOMAIN/health"
echo "  Logs:         docker compose logs -f nginx"
echo "  Cert renewal: automatic (certbot checks every 12h)"
echo
echo "Next steps:"
echo "  1. Edit $CONF_FILE — set proxy_pass to your origin server"
echo "  2. docker compose restart nginx"
echo "  3. In QRLive: set bypass_url = https://$DOMAIN/your-path for CN geo-routes"
