const API = "http://localhost:8000/api/v1";

async function seed() {
  const email = "dr.tester@docspace.com";
  const password = "Password123!";

  console.log("1. Ensuring test doctor exists...");
  let token = null;
  let slug = null;

  // Try login first
  const loginRes = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  if (loginRes.ok) {
    const data = await loginRes.json();
    token = data.access_token;
    slug = data.tenant?.slug;
    console.log(`Doctor logged in. Slug: ${slug}`);
  } else {
    // Register
    const regRes = await fetch(`${API}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        full_name: "Dr. Alexander Smith",
        specialty: "Cardiology"
      })
    });
    if (!regRes.ok) {
      console.error("Register failed:", await regRes.text());
      process.exit(1);
    }
    const data = await regRes.json();
    token = data.access_token;
    slug = data.tenant?.slug;
    console.log(`Doctor registered. Slug: ${slug}`);
  }

  const authHeader = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  };

  // Complete onboarding and setup profile
  console.log("2. Updating profile & services...");
  const profRes = await fetch(`${API}/doctor/profile`, {
    method: "PUT",
    headers: authHeader,
    body: JSON.stringify({
      full_name: "Dr. Alexander Smith",
      clinic_name: "Metro Heart & Health Center",
      location: "San Francisco, CA",
      speciality: "Cardiologist & Internal Medicine",
      bio: "Board-certified cardiologist with 15+ years of clinical experience specializing in preventive care, heart health, and comprehensive diagnostics.",
      onboarding_completed: true,
      services: {
        appointment: true,
        video_consultation: true,
        medicine_inventory: true,
        lab_reports: true
      }
    })
  });
  console.log("Profile update status:", profRes.status);

  // Setup schedule for current week
  const today = new Date();
  const dateStr = today.toISOString().split("T")[0];
  console.log(`3. Setting schedule for date: ${dateStr}...`);

  await fetch(`${API}/doctor/schedule`, {
    method: "POST",
    headers: authHeader,
    body: JSON.stringify({
      date: dateStr,
      start_time: "09:00",
      end_time: "17:00",
      type: "AVAILABLE"
    })
  }).catch(() => {});

  // Add an appointment
  console.log("4. Booking sample appointment...");
  const apptRes = await fetch(`${API}/doctor/appointments`, {
    method: "POST",
    headers: authHeader,
    body: JSON.stringify({
      patient_name: "Eleanor Vance",
      patient_phone: "+1 (555) 234-5678",
      date: dateStr,
      start_time: "10:00",
      end_time: "10:30",
      reason: "Follow-up ECG and blood pressure checkup"
    })
  });
  console.log("Appointment 1 booking status:", apptRes.status);

  // Add a video consultation appointment
  const appt2Res = await fetch(`${API}/doctor/appointments`, {
    method: "POST",
    headers: authHeader,
    body: JSON.stringify({
      patient_name: "James Wilson",
      patient_phone: "+1 (555) 987-6543",
      date: dateStr,
      start_time: "11:30",
      end_time: "12:00",
      reason: "[Video Consultation] Hypertension quarterly medication review"
    })
  });
  console.log("Appointment 2 booking status:", appt2Res.status);

  // Add an afternoon appointment and complete it
  const appt3Res = await fetch(`${API}/doctor/appointments`, {
    method: "POST",
    headers: authHeader,
    body: JSON.stringify({
      patient_name: "Sarah Jenkins",
      patient_phone: "+1 (555) 456-7890",
      date: dateStr,
      start_time: "14:00",
      end_time: "14:30",
      reason: "Post-cardiac rehab evaluation and blood panels"
    })
  });
  if (appt3Res.ok) {
    const appt3Data = await appt3Res.json();
    await fetch(`${API}/doctor/appointments/${appt3Data.id}/complete`, {
      method: "POST",
      headers: authHeader
    });
    console.log("Appointment 3 booked and completed.");
  }

  console.log("\n✅ Test doctor ready!");
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
  console.log(`Slug: ${slug}`);
}

seed().catch(err => {
  console.error("Seed error:", err);
  process.exit(1);
});

