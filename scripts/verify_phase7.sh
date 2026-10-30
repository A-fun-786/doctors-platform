#!/usr/bin/env bash

# Phase 7 Unified Verification & Hardening Suite
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "========================================================"
echo "  🩺 Starting DocSpace Phase 7 Unified Verification Suite"
echo "========================================================"

FAILED_STEPS=()

run_step() {
  local step_num="$1"
  local step_name="$2"
  local step_cmd="$3"

  echo ""
  echo "--------------------------------------------------------"
  echo "▶️  Step $step_num: $step_name"
  echo "--------------------------------------------------------"
  if eval "$step_cmd"; then
    echo "✅ [PASS] Step $step_num: $step_name"
  else
    echo "❌ [FAIL] Step $step_num: $step_name"
    FAILED_STEPS+=("Step $step_num: $step_name")
  fi
}

# 1. Backend Ruff Lint Check
run_step "7.1" "Backend Ruff Linting" "backend/.venv/bin/ruff check backend/"

# 2. Pytest Suite from Root
run_step "7.2" "Backend Pytest Suite (119 Tests)" "backend/.venv/bin/pytest backend/tests/ -v"

# 3. Alembic Migration Upgrade/Downgrade Reversibility
run_step "7.3" "Alembic Migration Reversibility (006 & 007)" \
  "cd backend && DATABASE_URL=\"sqlite:///./test_phase7_mig.db\" .venv/bin/alembic upgrade head && DATABASE_URL=\"sqlite:///./test_phase7_mig.db\" .venv/bin/alembic downgrade -2 && DATABASE_URL=\"sqlite:///./test_phase7_mig.db\" .venv/bin/alembic upgrade head && rm -f test_phase7_mig.db"

# 4. Frontend TypeScript Typecheck
run_step "7.4" "Frontend TypeScript Typecheck (tsc --noEmit)" "npx tsc --noEmit"

# 5. Frontend Next.js Linting
run_step "7.5" "Frontend Next.js Linting (npm run lint)" "npm run lint"

# 6. Frontend Production Build
run_step "7.6" "Frontend Production Build (npm run build)" "npm run build"

# 7. Live Server E2E Verification
echo ""
echo "--------------------------------------------------------"
echo "▶️  Step 7.7: Live Server Bootstrapping & E2E Suite"
echo "--------------------------------------------------------"

# Ensure port 8000 is stopped before starting test backend
./scripts/stop-servers.sh > /dev/null 2>&1 || true
export API_URL="http://127.0.0.1:8000"

# Ensure isolated SQLite database is migrated for live testing
cd "$ROOT_DIR/backend"
DATABASE_URL="sqlite:///./live_test.db" .venv/bin/alembic upgrade head > /dev/null 2>&1
cd "$ROOT_DIR"

# Launch backend with isolated database on port 8000
echo "Starting test backend server on port 8000..."
cd "$ROOT_DIR/backend"
DATABASE_URL="sqlite:///./live_test.db" ALLOW_MOCK_AUTH="true" ENVIRONMENT="test" \
  nohup .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 > /tmp/phase7_backend.log 2>&1 &
BACKEND_PID=$!
cd "$ROOT_DIR"

# Wait for backend to be ready
RETRIES=20
READY=0
while [ $RETRIES -gt 0 ]; do
  if curl -s http://127.0.0.1:8000/api/v1/health | grep -q '"status":"healthy"'; then
    READY=1
    break
  fi
  sleep 0.5
  RETRIES=$((RETRIES - 1))
done

if [ $READY -eq 1 ]; then
  echo "✅ Backend is live and healthy."
  if node "$ROOT_DIR/scripts/verify_phase7_live.mjs"; then
    echo "✅ [PASS] Step 7.7: Live Server E2E Suite"
  else
    echo "❌ [FAIL] Step 7.7: Live Server E2E Suite"
    FAILED_STEPS+=("Step 7.7: Live Server E2E Suite")
  fi
else
  echo "❌ Backend failed to become healthy."
  cat /tmp/phase7_backend.log
  FAILED_STEPS+=("Step 7.7: Live Server Bootstrapping")
fi

# Cleanup backend
echo "Tearing down test backend server..."
kill -15 "$BACKEND_PID" 2>/dev/null || true
sleep 1
kill -9 "$BACKEND_PID" 2>/dev/null || true
rm -f "$ROOT_DIR/backend/live_test.db" /tmp/phase7_backend.log

echo ""
echo "========================================================"
if [ ${#FAILED_STEPS[@]} -eq 0 ]; then
  echo "🎉 ALL PHASE 7 VERIFICATION GATES PASSED PERFECTLY!"
  echo "========================================================"
  exit 0
else
  echo "❌ PHASE 7 VERIFICATION ENCOUNTERED FAILURES:"
  for f in "${FAILED_STEPS[@]}"; do
    echo "   - $f"
  done
  echo "========================================================"
  exit 1
fi
