#!/usr/bin/env bash

# DocSpace Servers Starter Script
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_DIR="$ROOT_DIR/.pids"
LOG_DIR="$ROOT_DIR/logs"

mkdir -p "$PID_DIR" "$LOG_DIR"

echo "=================================================="
echo "  🩺 Starting DocSpace Platform Servers"
echo "=================================================="

# Check if Backend is already running
if lsof -iTCP:8000 -sTCP:LISTEN -P -n > /dev/null 2>&1; then
  echo "⚠️  Backend port 8000 is already in use."
  EXISTING_BACKEND_PID=$(lsof -ti:8000 | tr '\n' ' ')
  echo "   Running PID(s): $EXISTING_BACKEND_PID"
else
  echo "🚀 Starting FastAPI Backend on port 8000..."
  cd "$ROOT_DIR/backend"
  if [ -f ".venv/bin/uvicorn" ]; then
    UVICORN_CMD=".venv/bin/uvicorn"
  elif command -v uvicorn > /dev/null 2>&1; then
    UVICORN_CMD="uvicorn"
  else
    UVICORN_CMD="python3 -m uvicorn"
  fi

  nohup $UVICORN_CMD app.main:app --host 0.0.0.0 --port 8000 --reload > "$LOG_DIR/backend.log" 2>&1 &
  BACKEND_PID=$!
  echo "$BACKEND_PID" > "$PID_DIR/backend.pid"
  echo "   ✅ Backend started (PID: $BACKEND_PID) -> logs: logs/backend.log"
fi

# Check if Frontend is already running
if lsof -iTCP:3000 -sTCP:LISTEN -P -n > /dev/null 2>&1; then
  echo "⚠️  Frontend port 3000 is already in use."
  EXISTING_FRONTEND_PID=$(lsof -ti:3000 | tr '\n' ' ')
  echo "   Running PID(s): $EXISTING_FRONTEND_PID"
else
  echo "🚀 Starting Next.js Frontend on port 3000..."
  cd "$ROOT_DIR"
  nohup npm run dev > "$LOG_DIR/frontend.log" 2>&1 &
  FRONTEND_PID=$!
  echo "$FRONTEND_PID" > "$PID_DIR/frontend.pid"
  echo "   ✅ Frontend started (PID: $FRONTEND_PID) -> logs: logs/frontend.log"
fi

echo ""
echo "=================================================="
echo "  🎉 DocSpace Platform is Live!"
echo "=================================================="
echo "  🌐 Frontend Web:       http://localhost:3000"
echo "  ⚙️  Backend API:        http://localhost:8000"
echo "  📚 API Docs (Swagger): http://localhost:8000/docs"
echo "--------------------------------------------------"
echo "  🛑 Press CTRL+C to stop both servers"
echo "=================================================="

# If background mode flag is passed, exit here
if [ "$1" = "--background" ] || [ "$1" = "-d" ] || [ "$1" = "--daemon" ]; then
  echo "Running in background mode. Use ./stop.sh to terminate."
  exit 0
fi

# Cleanup on Ctrl+C or kill
cleanup() {
  echo ""
  echo "Received shutdown signal. Stopping servers..."
  "$ROOT_DIR/stop-servers.sh"
  exit 0
}
trap cleanup SIGINT SIGTERM

echo "📡 Streaming combined server logs (Ctrl+C to quit)..."
touch "$LOG_DIR/backend.log" "$LOG_DIR/frontend.log"
tail -n 20 -f "$LOG_DIR/backend.log" "$LOG_DIR/frontend.log" &
TAIL_PID=$!
wait $TAIL_PID
