#!/usr/bin/env bash

# Pinggy Tunnel Script for DocSpace Platform
PORT="${1:-3000}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TUNNEL_FILE="$ROOT_DIR/TUNNEL_URL.txt"

echo "========================================================"
echo " Starting Pinggy Tunnel for http://localhost:$PORT"
echo "========================================================"

# Check if target port is listening
if ! lsof -iTCP:"$PORT" -sTCP:LISTEN -P -n > /dev/null 2>&1; then
  echo "⚠️  Notice: Nothing is listening on port $PORT yet."
  echo "Make sure your server is running (e.g. npm run dev or npm run servers:start)."
  echo ""
fi

echo "Connecting to Pinggy..."
echo "Once connected, your URL will appear below and in TUNNEL_URL.txt"
echo "Web inspection dashboard will be available at: http://localhost:4300"
echo "========================================================"
echo ""

export SSH_ASKPASS_REQUIRE=force
export SSH_ASKPASS=/bin/echo

while true; do
  ssh -o StrictHostKeyChecking=no \
      -o ServerAliveInterval=30 \
      -o ServerAliveCountMax=3 \
      -p 443 \
      -R0:localhost:"$PORT" \
      -L4300:localhost:4300 \
      a.pinggy.io </dev/null 2>&1 | while IFS= read -r line; do
        if [[ "$line" =~ https://[a-zA-Z0-9.-]+\.pinggy\.(net|link) ]]; then
          URL=$(echo "$line" | grep -oE "https://[a-zA-Z0-9.-]+\.pinggy\.(net|link)" | head -n 1)
          echo ""
          echo "🎉 ========================================================"
          echo "   PUBLIC URL: $URL"
          echo "   LIVE LOGS : http://localhost:4300"
          echo "==========================================================="
          echo ""
          echo "$URL" > "$TUNNEL_FILE"
        else
          echo "$line"
        fi
      done

  echo ""
  echo "Connection closed. Reconnecting in 3 seconds (Press Ctrl+C to stop)..."
  sleep 3
done
