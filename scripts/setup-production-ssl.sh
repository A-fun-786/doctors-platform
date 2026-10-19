#!/usr/bin/env bash
# ==============================================================================
# Automated Production SSL Setup for gosmartclinic.com via Certbot & Nginx
# ==============================================================================
set -euo pipefail

DOMAIN="gosmartclinic.com"
WWW_DOMAIN="www.gosmartclinic.com"
EMAIL="${1:-}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CERTS_DIR="$ROOT_DIR/nginx/certs"
WEBROOT="/var/www/certbot"

echo "=== Production SSL Provisioning for $DOMAIN ==="

if [ -z "$EMAIL" ]; then
    echo "Usage: ./scripts/setup-production-ssl.sh <your-email@example.com>"
    echo "Error: Email is required for Let's Encrypt registration."
    exit 1
fi

# Ensure certbot is installed
if ! command -v certbot &> /dev/null; then
    echo "Certbot is not installed. Installing via apt-get if on Ubuntu/Debian..."
    if command -v apt-get &> /dev/null; then
        sudo apt-get update && sudo apt-get install -y certbot
    else
        echo "Please install certbot on your host machine first."
        exit 1
    fi
fi

# Ensure webroot directory exists
sudo mkdir -p "$WEBROOT"

echo "Requesting Let's Encrypt SSL certificate for $DOMAIN and $WWW_DOMAIN..."
sudo certbot certonly \
    --webroot \
    -w "$WEBROOT" \
    -d "$DOMAIN" \
    -d "$WWW_DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --non-interactive

# Copy / link certs to nginx/certs
echo "Symlinking certificates into $CERTS_DIR..."
mkdir -p "$CERTS_DIR"
sudo ln -sf "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$CERTS_DIR/fullchain.pem"
sudo ln -sf "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$CERTS_DIR/privkey.pem"

# Reload Nginx container if running
if command -v docker &> /dev/null; then
    if docker ps --format '{{.Names}}' | grep -q 'doctor_platform_proxy'; then
        echo "Reloading Nginx in Docker container..."
        docker exec doctor_platform_proxy nginx -s reload
    fi
fi

echo "=== SSL setup completed successfully for $DOMAIN ==="

