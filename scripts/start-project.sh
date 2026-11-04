#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="/opt/homebrew/bin:$PATH"
LOG_DIR="$ROOT/logs"
RUN_DIR="$ROOT/run"
mkdir -p "$LOG_DIR" "$RUN_DIR"

DOCKER_COMPOSE_CMD=""
if command -v docker >/dev/null 2>&1; then
  if docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE_CMD="docker compose"
  elif command -v docker-compose >/dev/null 2>&1; then
    DOCKER_COMPOSE_CMD="docker-compose"
  fi
fi

usage() {
  cat <<EOF
Usage: $(basename "$0") <command>

Commands:
  start     Start Postgres (via docker compose), backend and frontend
  stop      Stop backend and frontend processes, stop Postgres container
  restart   Stop then start
  status    Show status and PIDs
  help      Show this message

This script creates logs in $LOG_DIR and pidfiles in $RUN_DIR.
EOF
}

require() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Required command '$1' not found. Please install it and retry." >&2
    exit 1
  fi
}

start_postgres() {
  if [ -z "$DOCKER_COMPOSE_CMD" ]; then
    echo "Docker compose not found; skipping Postgres startup. Please start Postgres manually." >&2
    return
  fi
  echo "Starting Postgres with: $DOCKER_COMPOSE_CMD up -d postgres"
  (cd "$ROOT" && $DOCKER_COMPOSE_CMD up -d postgres)
}

stop_postgres() {
  if [ -z "$DOCKER_COMPOSE_CMD" ]; then
    echo "Docker compose not found; skipping Postgres stop." >&2
    return
  fi
  echo "Stopping Postgres with: $DOCKER_COMPOSE_CMD stop postgres"
  (cd "$ROOT" && $DOCKER_COMPOSE_CMD stop postgres || true)
}

start_backend() {
  if lsof -i :8000 >/dev/null 2>&1; then
    echo "Backend is already running on port 8000 (pid $(lsof -ti :8000 | head -n 1))"
    lsof -ti :8000 | head -n 1 > "$RUN_DIR/backend.pid"
    return
  fi
  echo "Setting up backend virtualenv and dependencies..."
  VENV="$ROOT/backend/.venv"
  if [ ! -d "$VENV" ]; then
    python3 -m venv "$VENV"
  fi
  PIP="$VENV/bin/pip"
  PY="$VENV/bin/python"
  "$PIP" install --upgrade pip >/dev/null
  if [ -f "$ROOT/backend/requirements.txt" ]; then
    "$PIP" install -r "$ROOT/backend/requirements.txt"
  fi

  echo "Starting backend (uvicorn)"
  pushd "$ROOT/backend" >/dev/null
  nohup "$PY" -m uvicorn app.main:app --reload --port 8000 --host 0.0.0.0 >"$LOG_DIR/backend.log" 2>&1 &
  echo $! > "$RUN_DIR/backend.pid"
  popd >/dev/null
  echo "Backend pid: $(cat "$RUN_DIR/backend.pid")"
}

stop_backend() {
  PID_FILE="$RUN_DIR/backend.pid"
  if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    echo "Stopping backend pid $PID"
    kill "$PID" 2>/dev/null || true
    rm -f "$PID_FILE"
  else
    echo "No backend pidfile found."
  fi
  lsof -ti :8000 | xargs kill -9 2>/dev/null || true
}

start_frontend() {
  require npm
  if lsof -i :3000 >/dev/null 2>&1; then
    echo "Frontend is already running on port 3000 (pid $(lsof -ti :3000 | head -n 1))"
    lsof -ti :3000 | head -n 1 > "$RUN_DIR/frontend.pid"
    return
  fi
  echo "Installing frontend dependencies (may be skipped if already installed)"
  pushd "$ROOT" >/dev/null
  npm install --silent || true
  echo "Starting frontend (Next.js dev server)"
  nohup npm run dev >"$LOG_DIR/frontend.log" 2>&1 &
  echo $! > "$RUN_DIR/frontend.pid"
  popd >/dev/null
  echo "Frontend pid: $(cat "$RUN_DIR/frontend.pid")"
}

stop_frontend() {
  PID_FILE="$RUN_DIR/frontend.pid"
  if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    echo "Stopping frontend pid $PID"
    kill "$PID" 2>/dev/null || true
    rm -f "$PID_FILE"
  else
    echo "No frontend pidfile found."
  fi
  lsof -ti :3000 | xargs kill -9 2>/dev/null || true
}

status() {
  echo "Logs directory: $LOG_DIR"
  echo "Run directory: $RUN_DIR"
  if [ -f "$RUN_DIR/backend.pid" ]; then
    echo "Backend pid: $(cat $RUN_DIR/backend.pid)"
  else
    echo "Backend not running (no pidfile)"
  fi
  if [ -f "$RUN_DIR/frontend.pid" ]; then
    echo "Frontend pid: $(cat $RUN_DIR/frontend.pid)"
  else
    echo "Frontend not running (no pidfile)"
  fi
  if [ -n "$DOCKER_COMPOSE_CMD" ]; then
    echo "Postgres container status:"
    (cd "$ROOT" && $DOCKER_COMPOSE_CMD ps postgres) || true
  else
    echo "Docker compose not available; cannot show Postgres status."
  fi
}

case ${1-} in
  start|up)
    start_postgres
    start_backend
    if command -v npm >/dev/null 2>&1; then
      start_frontend
    else
      echo "npm not found; frontend not started. Install Node/npm to run the frontend." >&2
    fi
    ;;
  stop|down)
    stop_frontend
    stop_backend
    stop_postgres
    ;;
  restart)
    $0 stop
    sleep 1
    $0 start
    ;;
  status)
    status
    ;;
  help|-h|--help|"")
    usage
    ;;
  *)
    echo "Unknown command: $1" >&2
    usage
    exit 2
    ;;
esac
