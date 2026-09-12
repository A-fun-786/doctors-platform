#!/usr/bin/env bash

# DocSpace Servers Stopper Script
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_DIR="$ROOT_DIR/.pids"

echo "=================================================="
echo "  🛑 Stopping DocSpace Platform Servers"
echo "=================================================="

stop_service() {
  local service_name="$1"
  local port="$2"
  local pid_file="$PID_DIR/$service_name.pid"

  echo "Stopping $service_name (Port $port)..."

  # 1. Stop via recorded PID
  if [ -f "$pid_file" ]; then
    PID=$(cat "$pid_file" 2>/dev/null || true)
    if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
      kill "$PID" 2>/dev/null || true
    fi
    rm -f "$pid_file"
  fi

  # 2. Stop any process listening on the port
  PIDS=$(lsof -ti:"$port" 2>/dev/null || true)
  if [ -n "$PIDS" ]; then
    for p in $PIDS; do
      kill -15 "$p" 2>/dev/null || true
    done
    sleep 0.5
    for p in $PIDS; do
      if kill -0 "$p" 2>/dev/null; then
        kill -9 "$p" 2>/dev/null || true
      fi
    done
  fi

  # 3. Final Verification
  sleep 0.5
  if lsof -iTCP:"$port" -sTCP:LISTEN -P -n > /dev/null 2>&1; then
    echo "   ⚠️  Port $port is still active. Run with sudo or check terminal owner."
  else
    echo "   ✅ $service_name stopped successfully."
  fi
}

# Stop Frontend and Backend
stop_service "frontend" 3000
stop_service "backend" 8000

echo ""
echo "=================================================="
echo "  ✨ DocSpace stop routine completed."
echo "=================================================="
