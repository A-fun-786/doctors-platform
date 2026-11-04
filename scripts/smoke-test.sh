#!/usr/bin/env bash
# ==============================================================================
# Production Post-Deployment Smoke Test Suite
# Usage: ./scripts/smoke-test.sh [TARGET_URL]
# Default TARGET_URL: http://127.0.0.1:8000
# ==============================================================================
set -euo pipefail

TARGET_URL="${1:-http://127.0.0.1:8000}"
# Trim trailing slash if present
TARGET_URL="${TARGET_URL%/}"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}======================================================${NC}"
echo -e "${YELLOW} Running Production Smoke Tests against: ${TARGET_URL}${NC}"
echo -e "${YELLOW}======================================================${NC}"

FAILED=0

run_check() {
    local name="$1"
    local endpoint="$2"
    local expected_status="$3"
    local expected_pattern="${4:-}"

    echo -n "Checking ${name} [${endpoint}] ... "
    
    local response_file
    response_file=$(mktemp)
    local headers_file
    headers_file=$(mktemp)

    local http_status
    http_status=$(curl -s -o "${response_file}" -D "${headers_file}" -w "%{http_code}" "${TARGET_URL}${endpoint}" || echo "000")

    if [ "${http_status}" != "${expected_status}" ]; then
        echo -e "${RED}FAILED (HTTP ${http_status}, expected ${expected_status})${NC}"
        FAILED=$((FAILED + 1))
        rm -f "${response_file}" "${headers_file}"
        return
    fi

    if [ -n "${expected_pattern}" ]; then
        if ! grep -q "${expected_pattern}" "${response_file}"; then
            echo -e "${RED}FAILED (Body missing '${expected_pattern}')${NC}"
            cat "${response_file}"
            echo ""
            FAILED=$((FAILED + 1))
            rm -f "${response_file}" "${headers_file}"
            return
        fi
    fi

    echo -e "${GREEN}PASS (HTTP ${http_status})${NC}"
    rm -f "${response_file}" "${headers_file}"
}

run_header_check() {
    local name="$1"
    local endpoint="$2"
    local expected_header="$3"

    echo -n "Checking ${name} header on [${endpoint}] ... "
    local headers_file
    headers_file=$(mktemp)

    curl -s -o /dev/null -D "${headers_file}" "${TARGET_URL}${endpoint}" || true

    if grep -iq "${expected_header}" "${headers_file}"; then
        echo -e "${GREEN}PASS${NC}"
    else
        echo -e "${RED}FAILED (Header '${expected_header}' missing)${NC}"
        FAILED=$((FAILED + 1))
    fi
    rm -f "${headers_file}"
}

# 1. Health checks
run_check "Root Health" "/health" "200" '"status":"healthy"'
run_check "Database Health" "/api/v1/health/database" "200" '"database":"connected"'

# 2. Security & Request Correlation headers
run_header_check "Request ID Correlation" "/health" "x-request-id:"
run_header_check "X-Content-Type-Options" "/health" "x-content-type-options: nosniff"
run_header_check "X-Frame-Options" "/health" "x-frame-options: DENY"

# 3. Public API contract and 404 boundary
run_check "Nonexistent Tenant 404" "/api/v1/public/tenants/__nonexistent_practice_smoke__/available-slots?date=2026-10-08" "404" "not found"

echo "------------------------------------------------------"
if [ ${FAILED} -eq 0 ]; then
    echo -e "${GREEN}All smoke tests passed successfully!${NC}"
    exit 0
else
    echo -e "${RED}${FAILED} smoke check(s) failed!${NC}"
    exit 1
fi
