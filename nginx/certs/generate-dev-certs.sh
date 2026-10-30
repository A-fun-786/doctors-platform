#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERT_PATH="$DIR/fullchain.pem"
KEY_PATH="$DIR/privkey.pem"

if [ -f "$CERT_PATH" ] && [ -f "$KEY_PATH" ]; then
    echo "SSL certificates already exist at $DIR"
    exit 0
fi

echo "Generating local development self-signed SSL certificates for localhost..."
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$KEY_PATH" \
    -out "$CERT_PATH" \
    -subj "/C=US/ST=Dev/L=Dev/O=DoctorsPlatform/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

chmod 600 "$KEY_PATH"
chmod 644 "$CERT_PATH"

echo "Certificates created successfully:"
echo " - Certificate: $CERT_PATH"
echo " - Private Key: $KEY_PATH"

