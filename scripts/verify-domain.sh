#!/usr/bin/env bash
# ==============================================================================
# Automated Verification Script for gosmartclinic.com
# ==============================================================================
set -euo pipefail

DOMAIN="gosmartclinic.com"
WWW_DOMAIN="www.gosmartclinic.com"

echo "=== Verifying Domain Configuration for $DOMAIN ==="
echo ""

# 1. DNS Resolution Check
echo "[1/4] Checking DNS Resolution..."
if command -v dig &> /dev/null; then
    APEX_IP=$(dig +short "$DOMAIN" | tail -n1)
    WWW_IP=$(dig +short "$WWW_DOMAIN" | tail -n1)
    echo "  - $DOMAIN points to: ${APEX_IP:-'UNRESOLVED'}"
    echo "  - $WWW_DOMAIN points to: ${WWW_IP:-'UNRESOLVED'}"
    if [ -z "$APEX_IP" ]; then
        echo "  [WARNING] DNS record for $DOMAIN is not yet resolving. Please check Hostinger DNS settings."
    fi
else
    echo "  'dig' command not found. Skipping DNS lookup."
fi
echo ""

# 2. HTTP to HTTPS Redirection Check
echo "[2/4] Testing HTTP -> HTTPS 301 Redirect..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -I "http://$DOMAIN" || echo "FAIL")
if [ "$HTTP_STATUS" = "301" ] || [ "$HTTP_STATUS" = "308" ]; then
    echo "  [OK] HTTP redirects with code $HTTP_STATUS"
else
    echo "  [NOTICE] HTTP status was: $HTTP_STATUS"
fi
echo ""

# 3. SSL & Health Check
echo "[3/4] Testing HTTPS Healthz Endpoint..."
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN/healthz" || echo "FAIL")
if [ "$HEALTH_STATUS" = "200" ]; then
    echo "  [OK] HTTPS /healthz responded with 200 OK"
else
    echo "  [NOTICE] HTTPS /healthz returned: $HEALTH_STATUS"
fi
echo ""

# 4. Frontend & Backend Reverse Proxy Check
echo "[4/4] Testing App Routes..."
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -L "https://$DOMAIN" || echo "FAIL")
echo "  - Frontend Root Status: $FRONTEND_STATUS"

echo ""
echo "=== Verification Complete ==="

