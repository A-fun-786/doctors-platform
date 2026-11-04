import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 }, // Ramp up to 20 users
    { duration: '1m', target: 20 },  // Stay at 20 users
    { duration: '15s', target: 0 },  // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<300'], // 95% of requests must complete below 300ms
    http_req_failed: ['rate<0.01'],    // Error rate below 1%
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://127.0.0.1:8000';
const TENANT_SLUG = __ENV.TENANT_SLUG || 'dr-smith';

export default function () {
  // 1. Query root health
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'health status is 200': (r) => r.status === 200,
    'has x-request-id': (r) => !!r.headers['X-Request-Id'],
  });

  // 2. Query public available slots (exercises slot generator & in-memory cache)
  const today = new Date().toISOString().split('T')[0];
  const slotsRes = http.get(`${BASE_URL}/api/v1/public/tenants/${TENANT_SLUG}/available-slots?date=${today}`);
  check(slotsRes, {
    'slots query returned valid status': (r) => r.status === 200 || r.status === 404,
  });

  sleep(1);
}
