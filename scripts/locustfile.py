"""
Locust load test script for the Doctors Platform Appointment System.
Usage:
    locust -f scripts/locustfile.py --host http://127.0.0.1:8000
"""
from datetime import date
from locust import HttpUser, task, between


class DoctorPlatformUser(HttpUser):
    wait_time = between(0.5, 2.0)

    @task(3)
    def test_health(self):
        self.client.get("/health")

    @task(5)
    def test_public_slots(self):
        today = date.today().isoformat()
        # Query public slots for tenant
        self.client.get(
            f"/api/v1/public/tenants/demo-tenant/available-slots?date={today}",
            name="/api/v1/public/tenants/[slug]/available-slots",
        )
