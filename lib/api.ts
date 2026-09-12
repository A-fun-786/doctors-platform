const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
const TOKEN_STORAGE_KEY = "docspace_auth_token";

export const DEFAULT_DOCTOR_AVATAR =
  "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400&auto=format&fit=crop&q=80";

export interface ServicesConfig {
  appointment: boolean;
  video_consultation: boolean;
  medicine_inventory: boolean;
  lab_reports: boolean;
}

export interface Tenant {
  id: string;
  slug: string;
  clinic_name?: string | null;
  location?: string | null;
  service_appointment?: boolean;
  service_video_consultation?: boolean;
  service_medicine_inventory?: boolean;
  service_lab_reports?: boolean;
}

export interface Doctor {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  avatar_url?: string | null;
  speciality?: string | null;
  bio?: string | null;
  onboarding_completed: boolean;
  auth_provider: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  doctor: Doctor;
  tenant: Tenant;
}

export interface DoctorMeResponse {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  avatar_url?: string | null;
  speciality?: string | null;
  bio?: string | null;
  onboarding_completed: boolean;
  auth_provider: string;
  tenant?: Tenant | null;
}

export interface DoctorProfileResponse {
  id: string;
  email: string;
  full_name: string;
  phone?: string | null;
  avatar_url?: string | null;
  app_icon_url?: string | null;
  speciality?: string | null;
  bio?: string | null;
  onboarding_completed: boolean;
  tenant_id?: string | null;
  tenant_slug?: string | null;
  clinic_name?: string | null;
  location?: string | null;
  services: ServicesConfig;
}

export interface DoctorProfileUpdateRequest {
  full_name?: string;
  phone?: string;
  avatar_url?: string;
  app_icon_url?: string;
  speciality?: string;
  bio?: string;
  clinic_name?: string;
  location?: string;
  services?: ServicesConfig;
  onboarding_completed?: boolean;
}

export interface PublicDoctorProfileResponse {
  full_name: string;
  avatar_url?: string | null;
  speciality?: string | null;
  bio?: string | null;
  clinic_name?: string | null;
  location?: string | null;
  slug: string;
  services: ServicesConfig;
}

export interface AppointmentBookingPayload {
  patient_name: string;
  patient_email: string;
  patient_phone: string;
  appointment_date: string;
  appointment_time: string;
  appointment_type: "in_clinic" | "video_consultation";
  notes?: string;
}

export interface ReportUploadPayload {
  patient_name: string;
  patient_phone: string;
  report_type: string;
  file_name: string;
  notes?: string;
}

export interface MedicineOrderPayload {
  patient_name: string;
  patient_phone: string;
  delivery_address: string;
  medicines: string;
  prescription_note?: string;
}

/**
 * Retrieve saved JWT access token from localStorage (client-side only).
 */
export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

/**
 * Store JWT access token in localStorage.
 */
export function setAuthToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

/**
 * Remove JWT access token from localStorage (Logout).
 */
export function removeAuthToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

/**
 * Authenticate or register a doctor using a Google ID token.
 */
export async function authenticateWithGoogle(credential: string): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/api/v1/auth/google`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ credential }),
  });

  if (!response.ok) {
    let errorMessage = "Authentication failed. Please try again.";
    try {
      const errorData = await response.json();
      if (errorData.detail) {
        errorMessage = typeof errorData.detail === "string" 
          ? errorData.detail 
          : JSON.stringify(errorData.detail);
      }
    } catch {
      // Fallback to generic message if JSON parsing fails
    }
    throw new Error(errorMessage);
  }

  const data: AuthResponse = await response.json();
  setAuthToken(data.access_token);
  return data;
}

/**
 * Register a new doctor using email and password.
 */
export async function registerWithEmail(
  email: string,
  password: string,
  fullName?: string
): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/api/v1/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      full_name: fullName,
    }),
  });

  if (!response.ok) {
    let errorMessage = "Registration failed. Please try again.";
    try {
      const errorData = await response.json();
      if (errorData.detail) {
        errorMessage =
          typeof errorData.detail === "string"
            ? errorData.detail
            : JSON.stringify(errorData.detail);
      }
    } catch {
      // Fallback
    }
    throw new Error(errorMessage);
  }

  const data: AuthResponse = await response.json();
  setAuthToken(data.access_token);
  return data;
}

/**
 * Log in an existing doctor using email and password.
 */
export async function loginWithEmail(
  email: string,
  password: string
): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    let errorMessage = "Invalid email or password.";
    try {
      const errorData = await response.json();
      if (errorData.detail) {
        errorMessage =
          typeof errorData.detail === "string"
            ? errorData.detail
            : JSON.stringify(errorData.detail);
      }
    } catch {
      // Fallback
    }
    throw new Error(errorMessage);
  }

  const data: AuthResponse = await response.json();
  setAuthToken(data.access_token);
  return data;
}

/**
 * Fetch the currently authenticated doctor profile and tenant workspace.
 */
export async function getCurrentDoctor(token?: string): Promise<DoctorMeResponse> {
  const authToken = token || getAuthToken();
  if (!authToken) {
    throw new Error("No authentication token found");
  }

  const response = await fetch(`${API_URL}/api/v1/auth/me`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      removeAuthToken();
      throw new Error("Session expired. Please log in again.");
    }
    let errorMessage = "Failed to fetch doctor profile";
    try {
      const errorData = await response.json();
      if (errorData.detail) {
        errorMessage = typeof errorData.detail === "string" ? errorData.detail : JSON.stringify(errorData.detail);
      }
    } catch {
      // Fallback
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * Fetch detailed doctor profile with services settings.
 */
export async function getDoctorProfile(): Promise<DoctorProfileResponse> {
  const authToken = getAuthToken();
  if (!authToken) {
    throw new Error("No authentication token found");
  }

  const response = await fetch(`${API_URL}/api/v1/doctor/profile`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      removeAuthToken();
      throw new Error("Session expired. Please log in again.");
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to load practice profile");
  }

  return response.json();
}

/**
 * Update practice profile, clinic details, and platform services.
 */
export async function updateDoctorProfile(
  payload: DoctorProfileUpdateRequest
): Promise<DoctorProfileResponse> {
  const authToken = getAuthToken();
  if (!authToken) {
    throw new Error("No authentication token found");
  }

  const response = await fetch(`${API_URL}/api/v1/doctor/profile`, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to update profile settings");
  }

  return response.json();
}

/**
 * Fetch public doctor and practice info for the patient-facing page.
 */
export async function getPublicDoctorProfile(
  slug: string
): Promise<PublicDoctorProfileResponse> {
  const response = await fetch(`${API_URL}/api/v1/public/tenants/${slug}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Doctor practice not found");
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to load doctor profile");
  }

  return response.json();
}

/**
 * Submit an appointment request on the patient page.
 */
export async function bookPublicAppointment(
  slug: string,
  payload: AppointmentBookingPayload
) {
  const response = await fetch(`${API_URL}/api/v1/public/tenants/${slug}/appointments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to book appointment");
  }

  return response.json();
}

/**
 * Upload a lab report from the patient page.
 */
export async function uploadPublicReport(
  slug: string,
  payload: ReportUploadPayload
) {
  const response = await fetch(`${API_URL}/api/v1/public/tenants/${slug}/reports`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to upload report");
  }

  return response.json();
}

/**
 * Order medicines from the patient page.
 */
export async function orderPublicMedicine(
  slug: string,
  payload: MedicineOrderPayload
) {
  const response = await fetch(`${API_URL}/api/v1/public/tenants/${slug}/medicine-orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to submit medicine request");
  }

  return response.json();
}

export interface AppPreviewResponse {
  app_name: string;
  package_name: string;
  has_custom_icon: boolean;
  app_icon_url?: string | null;
  latest_apk?: AppBuildStatusResponse | null;
}

export interface AppBuildStartResponse {
  message: string;
  task_id: string;
  status: string;
  app_name: string;
  package_name: string;
}

export interface AppBuildStatusResponse {
  task_id: string;
  status: "preparing" | "compiling" | "completed" | "failed";
  progress: number;
  app_name: string;
  package_name: string;
  apk_filename?: string;
  file_size?: number;
  error?: string;
}

/**
 * Fetch Android app branding preview (clinic name & package name).
 */
export async function getAppPreview(): Promise<AppPreviewResponse> {
  const authToken = getAuthToken();
  if (!authToken) throw new Error("No authentication token found");

  const response = await fetch(`${API_URL}/api/v1/doctor/app/preview`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to load app preview");
  }

  return response.json();
}

/**
 * Upload a custom app launcher icon for the doctor's Android app.
 */
export async function uploadAppIcon(file: File): Promise<{ message: string; app_icon_url: string }> {
  const authToken = getAuthToken();
  if (!authToken) throw new Error("No authentication token found");

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_URL}/api/v1/doctor/app/icon`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${authToken}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to upload app icon");
  }

  return response.json();
}

/**
 * Trigger background build of doctor's native Android app APK.
 */
export async function triggerAppBuild(): Promise<AppBuildStartResponse> {
  const authToken = getAuthToken();
  if (!authToken) throw new Error("No authentication token found");

  const response = await fetch(`${API_URL}/api/v1/doctor/app/build`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to start Android app build");
  }

  return response.json();
}

/**
 * Check compilation and packaging status of doctor's Android app.
 */
export async function getAppBuildStatus(taskId: string): Promise<AppBuildStatusResponse> {
  const authToken = getAuthToken();
  if (!authToken) throw new Error("No authentication token found");

  const response = await fetch(`${API_URL}/api/v1/doctor/app/build/${taskId}/status`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to retrieve build status");
  }

  return response.json();
}

/**
 * Get direct download URL for the built Android APK.
 */
export function getAppDownloadUrl(taskId: string): string {
  return `${API_URL}/api/v1/doctor/app/download/${taskId}`;
}

/**
 * Fetch raw compilation logs for an APK build.
 */
export async function getAppBuildLogs(taskId: string): Promise<{ task_id: string; logs: string }> {
  const authToken = getAuthToken();
  if (!authToken) throw new Error("No authentication token found");

  const response = await fetch(`${API_URL}/api/v1/doctor/app/build/${taskId}/logs`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to retrieve build logs");
  }

  return response.json();
}


