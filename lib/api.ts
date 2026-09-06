const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const TOKEN_STORAGE_KEY = "docspace_auth_token";

export interface Tenant {
  id: string;
  slug: string;
}

export interface Doctor {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string | null;
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
  avatar_url?: string | null;
  auth_provider: string;
  tenant?: Tenant | null;
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
