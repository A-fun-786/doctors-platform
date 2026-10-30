#!/usr/bin/env node

/**
 * Phase 7 Live HTTP Verification & Edge Case Acceptance Suite
 * Validates real server execution against all Phase 7 Playbooks.
 */

const BASE_URL = process.env.API_URL || 'http://127.0.0.1:8000';
const API = `${BASE_URL}/api/v1`;

const results = [];

function record(id, name, pass, detail = '') {
  results.push({ id, name, pass, detail });
  const status = pass ? '✅ PASS' : '❌ FAIL';
  console.log(`[${status}] ${id}: ${name} ${detail ? '(' + detail + ')' : ''}`);
}

async function request(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  let body = null;
  const text = await res.text();
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, headers: res.headers, body };
}

async function runSuite() {
  console.log('====================================================');
  console.log('  🧪 Running Phase 7 Live Verification & Edge Cases ');
  console.log('====================================================\n');

  // 1. Health Probe
  const health = await request('/health');
  record('LIVE-1.0', 'Backend Health Probe', health.status === 200, `Status: ${health.status}`);

  // 2. Doctor A Registration & Login
  const suffix = Math.floor(Math.random() * 100000);
  const emailA = `dr.alice.${suffix}@testclinic.com`;
  const regA = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: emailA,
      password: 'SecurePassword123!',
      full_name: 'Dr. Alice Smith',
      specialty: 'Cardiology'
    })
  });
  const tokenA = regA.body?.access_token;
  const slugA = regA.body?.tenant?.slug;
  record('LIVE-1.1', 'Doctor A Registration & Auth Token', [200, 201].includes(regA.status) && !!tokenA, `Slug: ${slugA}`);

  const authA = { Authorization: `Bearer ${tokenA}` };

  // 3. Enable practice services (lab reports & medicine orders)
  const profileUpdate = await request('/doctor/profile', {
    method: 'PUT',
    headers: authA,
    body: JSON.stringify({
      services: {
        appointment: true,
        video_consultation: true,
        medicine_inventory: true,
        lab_reports: true
      }
    })
  });
  record('LIVE-1.2', 'Doctor A Profile & Services Activation', profileUpdate.status === 200, `Status: ${profileUpdate.status}`);

  // 4. Schedule Edge Case: Inverted Time Range (17:00 to 09:00)
  const inverted = await request('/doctor/schedule', {
    method: 'POST',
    headers: authA,
    body: JSON.stringify({
      date: '2026-10-15',
      start_time: '17:00',
      end_time: '09:00',
      type: 'AVAILABLE'
    })
  });
  record('LIVE-2.1', 'Schedule Inverted Time Range Rejection', [400, 422].includes(inverted.status), `Status: ${inverted.status}`);

  // 5. Schedule Edge Case: Zero Duration (10:00 to 10:00)
  const zeroDur = await request('/doctor/schedule', {
    method: 'POST',
    headers: authA,
    body: JSON.stringify({
      date: '2026-10-15',
      start_time: '10:00',
      end_time: '10:00',
      type: 'AVAILABLE'
    })
  });
  record('LIVE-2.2', 'Schedule Zero-Duration Interval Rejection', [400, 422].includes(zeroDur.status), `Status: ${zeroDur.status}`);

  // 6. Normal Working Hours Creation (09:00 - 17:00)
  const validSched = await request('/doctor/schedule', {
    method: 'POST',
    headers: authA,
    body: JSON.stringify({
      date: '2026-10-15',
      start_time: '09:00',
      end_time: '17:00',
      type: 'AVAILABLE'
    })
  });
  record('LIVE-2.3', 'Working Hours Creation (09:00 - 17:00)', validSched.status === 201, `Status: ${validSched.status}`);

  // 7. Schedule Edge Case: Overlapping Available Windows (11:00 - 15:00)
  const overlapSched = await request('/doctor/schedule', {
    method: 'POST',
    headers: authA,
    body: JSON.stringify({
      date: '2026-10-15',
      start_time: '11:00',
      end_time: '15:00',
      type: 'AVAILABLE'
    })
  });
  record('LIVE-2.4', 'Overlapping AVAILABLE Window Rejection', overlapSched.status === 400, `Status: ${overlapSched.status}`);

  // 8. Schedule Exception: Leave (12:00 - 13:00)
  const leaveSched = await request('/doctor/schedule', {
    method: 'POST',
    headers: authA,
    body: JSON.stringify({
      date: '2026-10-15',
      start_time: '12:00',
      end_time: '13:00',
      type: 'LEAVE',
      reason: 'Lunch & Seminar'
    })
  });
  record('LIVE-2.5', 'Schedule Exception Creation (LEAVE)', leaveSched.status === 201, `Status: ${leaveSched.status}`);

  // 9. Schedule Partial Remainder: (18:00 - 18:45)
  const partialSched = await request('/doctor/schedule', {
    method: 'POST',
    headers: authA,
    body: JSON.stringify({
      date: '2026-10-15',
      start_time: '18:00',
      end_time: '18:45',
      type: 'AVAILABLE'
    })
  });
  record('LIVE-2.6', 'Non-Aligned Working Window Creation (18:00 - 18:45)', partialSched.status === 201, `Status: ${partialSched.status}`);

  // 10. Slot Generation Verification (30-min intervals, Leave subtraction, 15m remainder discarded)
  const slotsRes = await request('/doctor/available-slots?date=2026-10-15', { headers: authA });
  const slots = Array.isArray(slotsRes.body) ? slotsRes.body : (slotsRes.body?.slots || []);
  const hasLeaveSlot1 = slots.some(s => s.start && s.start.startsWith('12:00'));
  const hasLeaveSlot2 = slots.some(s => s.start && s.start.startsWith('12:30'));
  const hasPartialSlot1 = slots.some(s => s.start && s.start.startsWith('18:00'));
  const hasPartialRemainder = slots.some(s => s.start && s.start.startsWith('18:30') && s.end && s.end.startsWith('18:45'));

  const slotsValid = slotsRes.status === 200 && !hasLeaveSlot1 && !hasLeaveSlot2 && hasPartialSlot1 && !hasPartialRemainder;
  record('LIVE-3.1', 'Slot Slicing, Leave Subtraction & Remainder Handling', slotsValid, `Total slots: ${slots.length}`);

  // 11. Booking Happy Path (10:00 - 10:30)
  const book1 = await request('/doctor/appointments', {
    method: 'POST',
    headers: authA,
    body: JSON.stringify({
      patient_name: 'Sarah Connor',
      patient_contact: '9876543210',
      date: '2026-10-15',
      start_time: '10:00',
      end_time: '10:30',
      reason: 'General Checkup'
    })
  });
  const apt1Id = book1.body?.id;
  record('LIVE-4.1', 'Appointment Booking (10:00 - 10:30)', book1.status === 201 && book1.body?.status === 'BOOKED', `ID: ${apt1Id}`);

  // 12. Concurrency / Double-Booking Race Condition (Same slot 10:00 - 10:30)
  const bookConflict = await request('/doctor/appointments', {
    method: 'POST',
    headers: authA,
    body: JSON.stringify({
      patient_name: 'John Connor',
      patient_contact: '1234567890',
      date: '2026-10-15',
      start_time: '10:00',
      end_time: '10:30'
    })
  });
  record('LIVE-4.2', 'Double-Booking Conflict Rejection (HTTP 409)', bookConflict.status === 409, `Status: ${bookConflict.status}`);

  // 13. Slot Occupancy Check (10:00 slot must no longer appear)
  const slotsAfterBook = await request('/doctor/available-slots?date=2026-10-15', { headers: authA });
  const slotsB = Array.isArray(slotsAfterBook.body) ? slotsAfterBook.body : (slotsAfterBook.body?.slots || []);
  const hasBookedSlot = slotsB.some(s => s.start && s.start.startsWith('10:00'));
  record('LIVE-4.3', 'Booked Slot Removed From Available Slots', !hasBookedSlot, '10:00 slot removed');

  // 14. Reschedule Flow (Move from 10:00 to 14:00)
  const reschedule = await request(`/doctor/appointments/${apt1Id}`, {
    method: 'PATCH',
    headers: authA,
    body: JSON.stringify({
      date: '2026-10-15',
      start_time: '14:00',
      end_time: '14:30'
    })
  });
  record('LIVE-5.1', 'Appointment Rescheduling to 14:00', reschedule.status === 200, `New start: ${reschedule.body?.start_time}`);

  // Check that 10:00 is freed and 14:00 is now occupied
  const slotsAfterReschedule = await request('/doctor/available-slots?date=2026-10-15', { headers: authA });
  const slotsR = Array.isArray(slotsAfterReschedule.body) ? slotsAfterReschedule.body : (slotsAfterReschedule.body?.slots || []);
  const slot10Freed = slotsR.some(s => s.start && s.start.startsWith('10:00'));
  const slot14Occupied = !slotsR.some(s => s.start && s.start.startsWith('14:00'));
  record('LIVE-5.2', 'Reschedule Slot Reversal (10:00 Freed, 14:00 Occupied)', slot10Freed && slot14Occupied, 'Freed 10:00 & occupied 14:00');

  // 15. Cancellation Flow
  const cancelRes = await request(`/doctor/appointments/${apt1Id}/cancel`, {
    method: 'POST',
    headers: authA,
    body: JSON.stringify({ reason: 'Patient emergency' })
  });
  record('LIVE-6.1', 'Appointment Cancellation Transition', cancelRes.status === 200 && cancelRes.body?.status === 'CANCELLED', `Status: ${cancelRes.body?.status}`);

  // Check that 14:00 is freed after cancellation
  const slotsAfterCancel = await request('/doctor/available-slots?date=2026-10-15', { headers: authA });
  const slotsC = Array.isArray(slotsAfterCancel.body) ? slotsAfterCancel.body : (slotsAfterCancel.body?.slots || []);
  const slot14Freed = slotsC.some(s => s.start && s.start.startsWith('14:00'));
  record('LIVE-6.2', 'Cancelled Slot Freed For Re-Booking', slot14Freed, '14:00 slot restored to available');

  // 16. Completion Flow (Book 11:00 and Complete)
  const book2 = await request('/doctor/appointments', {
    method: 'POST',
    headers: authA,
    body: JSON.stringify({
      patient_name: 'Kyle Reese',
      date: '2026-10-15',
      start_time: '11:00',
      end_time: '11:30'
    })
  });
  const apt2Id = book2.body?.id;
  const completeRes = await request(`/doctor/appointments/${apt2Id}/complete`, {
    method: 'POST',
    headers: authA
  });
  record('LIVE-7.1', 'Appointment Completion Transition', completeRes.status === 200 && completeRes.body?.status === 'COMPLETED', `Status: ${completeRes.body?.status}`);

  // 17. Doctor Calendar Aggregator View
  const calRes = await request('/doctor/calendar?from=2026-10-15&to=2026-10-15', { headers: authA });
  const dayEvents = calRes.body?.dates?.[0]?.events || [];
  const eventTypes = new Set(dayEvents.map(e => e.type));
  const hasMixed = eventTypes.has('AVAILABLE') && eventTypes.has('APPOINTMENT') && eventTypes.has('LEAVE');
  
  // Verify chronological order
  let sorted = true;
  for (let i = 1; i < dayEvents.length; i++) {
    if (dayEvents[i].start < dayEvents[i - 1].start) {
      sorted = false;
      break;
    }
  }
  record('LIVE-8.1', 'Calendar Unified Timeline & Chronological Ordering', calRes.status === 200 && hasMixed && sorted, `Events count: ${dayEvents.length}`);

  // Edge Case: Calendar Range > 31 days
  const calOverMax = await request('/doctor/calendar?from=2026-10-01&to=2026-11-15', { headers: authA });
  record('LIVE-8.2', 'Calendar >31-Day Range Validation', calOverMax.status === 400, `Status: ${calOverMax.status}`);

  // 18. Public Slot Endpoint & Privacy Audit
  const publicSlots = await request(`/public/tenants/${slugA}/available-slots?date=2026-10-15`);
  const pubSlotList = Array.isArray(publicSlots.body) ? publicSlots.body : (publicSlots.body?.slots || []);
  const noPII = pubSlotList.every(s => !s.patient_name && !s.doctor_id && !s.notes);
  record('LIVE-9.1', 'Public Slot Availability & Patient Privacy Audit', publicSlots.status === 200 && pubSlotList.length > 0 && noPII, `Public slots: ${pubSlotList.length}`);

  // Edge Case: Non-Existent Slug
  const badSlug = await request('/public/tenants/nonexistent-doctor-slug-404/available-slots?date=2026-10-15');
  record('LIVE-9.2', 'Public Non-Existent Slug 404 Rejection', badSlug.status === 404, `Status: ${badSlug.status}`);

  // 19. Multi-Doctor Cross-Tenant Isolation
  const emailB = `dr.bob.${suffix}@testclinic.com`;
  const regB = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: emailB,
      password: 'SecurePassword123!',
      full_name: 'Dr. Bob Jones',
      specialty: 'Pediatrics'
    })
  });
  const tokenB = regB.body?.access_token;
  const authB = { Authorization: `Bearer ${tokenB}` };

  // Doctor B attempts to view Doctor A's appointment
  const tamperView = await request(`/doctor/appointments/${apt2Id}`, { headers: authB });
  // Doctor B attempts to cancel Doctor A's appointment
  const tamperCancel = await request(`/doctor/appointments/${apt2Id}/cancel`, {
    method: 'POST',
    headers: authB,
    body: JSON.stringify({ reason: 'Attack' })
  });
  // Doctor B attempts to delete Doctor A's schedule
  const schedAId = validSched.body?.id;
  const tamperDelete = await request(`/doctor/schedule/${schedAId}`, {
    method: 'DELETE',
    headers: authB
  });

  const isolationPass = tamperView.status === 404 && tamperCancel.status === 404 && tamperDelete.status === 404;
  record('LIVE-10.1', 'Cross-Doctor Multi-Tenant Isolation Enforcement', isolationPass, 'All cross-doctor tampering returned 404');

  // 20. Dead Stub Route Cleanup Verification
  const stubAppt = await request(`/public/tenants/${slugA}/appointments`, {
    method: 'POST',
    body: JSON.stringify({ patient_name: 'Stub Test' })
  });
  const stubMed = await request(`/public/tenants/${slugA}/medicine-orders`, {
    method: 'POST',
    body: JSON.stringify({
      patient_name: 'John Doe',
      patient_phone: '1234567890',
      delivery_address: '123 Main Street',
      medicines: 'Paracetamol 500mg'
    })
  });
  const stubRep = await request(`/public/tenants/${slugA}/reports`, {
    method: 'POST',
    body: JSON.stringify({
      patient_name: 'Jane Doe',
      patient_phone: '9876543210',
      report_type: 'Blood Test',
      file_name: 'lab_results.pdf'
    })
  });

  const stubPass = [404, 405].includes(stubAppt.status) && stubMed.status === 201 && stubRep.status === 201;
  record('LIVE-11.1', 'Dead Booking Stub Route Cleanup & Remaining Stubs Intact', stubPass, `Appt: ${stubAppt.status}, Med: ${stubMed.status}, Rep: ${stubRep.status}`);

  // Summary
  console.log('\n====================================================');
  const allPass = results.every(r => r.pass);
  const passedCount = results.filter(r => r.pass).length;
  console.log(`  Phase 7 Live Verification Scorecard: ${passedCount}/${results.length} Passed`);
  console.log('====================================================\n');

  if (!allPass) {
    console.error('❌ Some live checks failed!');
    process.exit(1);
  } else {
    console.log('🎉 ALL LIVE SERVER CHECKS PASSED PERFECTLY!');
    process.exit(0);
  }
}

runSuite().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
