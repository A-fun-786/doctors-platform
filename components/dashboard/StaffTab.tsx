"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Building2,
  Phone,
  Mail,
  Edit2,
  Trash2,
  RefreshCw,
  X,
  Stethoscope,
  ChevronRight,
  ChevronDown,
  UserCheck,
  Calendar,
  ShieldAlert,
  Key,
  ShieldCheck,
  Lock,
  Copy,
  Check,
  Eye,
  EyeOff,
  ArrowLeft,
  User,
  Save,
  Briefcase,
  CreditCard,
  FileText,
  UserPlus,
  Sparkles,
} from "lucide-react";
import {
  DoctorMeResponse,
  StaffMember,
  listStaff,
  createStaffMember,
  updateStaffMember,
  resetStaffPassword,
  deleteStaffMember,
  isDoctorRole,
} from "@/lib/api";
import { DashboardTabId } from "./DashboardShell";

interface StaffTabProps {
  doctor: DoctorMeResponse;
  onNavigateTab?: (tab: DashboardTabId) => void;
}

const ROLE_OPTIONS = [
  "Doctor",
  "Junior Doctor",
  "Nurse",
  "Receptionist",
  "Pharmacist",
  "Lab Technician",
  "Billing Executive",
  "Administrative Assistant",
  "Other",
];

const SPECIALITY_OPTIONS = [
  "General Physician",
  "Cardiologist",
  "Dermatologist",
  "Pediatrician",
  "Gynecologist & Obstetrician",
  "Orthopedic Surgeon",
  "Neurologist",
  "ENT Specialist",
  "Psychiatrist",
  "Dentist",
  "Ophthalmologist",
  "Endocrinologist",
  "Pulmonologist",
  "Gastroenterologist",
  "General Surgeon",
  "Oncologist",
  "Radiologist",
  "Pathologist",
  "Nephrologist",
  "Urologist",
  "Emergency Medicine",
  "Other Specialist",
];

const DEPARTMENT_OPTIONS = [
  "All Departments",
  "Clinical",
  "Nursing",
  "Front Desk",
  "Pharmacy",
  "Laboratory",
  "Administration",
  "Emergency",
  "General",
];

// Helper to format currency
function formatINR(paise: number): string {
  if (!paise || paise <= 0) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

export default function StaffTab({ doctor }: StaffTabProps) {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Staff roster
  const [staffList, setStaffList] = useState<StaffMember[]>([]);

  // Filtering states
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("All Departments");
  const [quickFilter, setQuickFilter] = useState<"all" | "doctors" | "active" | "portal">("all");

  // Modals state
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [resetPasswordStaff, setResetPasswordStaff] = useState<StaffMember | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [editPasswordInput, setEditPasswordInput] = useState("");

  // Credentials presentation modal & session memory
  const [credentialsModal, setCredentialsModal] = useState<{
    staffName: string;
    role: string;
    username: string;
    email: string;
    password: string;
  } | null>(null);
  const [copiedCredentials, setCopiedCredentials] = useState(false);
  const [recentPasswords, setRecentPasswords] = useState<{ [staffId: string]: string }>({});
  const [showRecentPassword, setShowRecentPassword] = useState(false);
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [copiedStaffId, setCopiedStaffId] = useState<string | null>(null);
  const [editModeEnteredAt, setEditModeEnteredAt] = useState<number>(0);

  const startEditingStaff = (staff: StaffMember) => {
    setSuccessMsg(null);
    setErrorMsg(null);
    const isDoc = isDoctorRole(staff.role);
    setEditingStaff({
      ...staff,
      speciality: isDoc ? (staff.speciality || "General Physician") : (staff.speciality || ""),
    });
    setEditPasswordInput("");
    setSelectedStaff(null);
    setEditModeEnteredAt(Date.now());
  };

  const isStaffFormDirty = (editing: StaffMember | null): boolean => {
    if (!editing) return false;
    const original = staffList.find((s) => s.id === editing.id);
    if (!original) return false;

    if (editPasswordInput.trim().length > 0) return true;
    if (editing.full_name.trim() !== original.full_name.trim()) return true;
    if (editing.role !== original.role) return true;
    if ((editing.speciality || "").trim() !== (original.speciality || "").trim()) return true;
    if (editing.department !== original.department) return true;
    if (editing.phone.trim() !== original.phone.trim()) return true;
    if ((editing.email || "").trim() !== (original.email || "").trim()) return true;
    if (editing.status !== original.status) return true;
    if (editing.employment_type !== original.employment_type) return true;
    if (editing.base_salary_paise !== original.base_salary_paise) return true;
    if ((editing.emergency_contact || "").trim() !== (original.emergency_contact || "").trim()) return true;
    if ((editing.notes || "").trim() !== (original.notes || "").trim()) return true;
    if (Boolean(editing.can_login) !== Boolean(original.can_login)) return true;
    if ((editing.username || "").trim() !== (original.username || "").trim()) return true;

    return false;
  };

  const cancelEditingStaff = () => {
    if (editingStaff) {
      const original = staffList.find((s) => s.id === editingStaff.id) || null;
      setSelectedStaff(original);
    }
    setEditingStaff(null);
    setEditPasswordInput("");
  };

  const copyToClipboard = (text: string, idKey: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedStaffId(idKey);
    setTimeout(() => {
      setCopiedStaffId((prev) => (prev === idKey ? null : prev));
    }, 2000);
  };

  const derivePreviewUsername = (fullName: string): string => {
    const raw = (fullName || "").toLowerCase().trim();
    if (!raw) return "username";
    const honorifics = new Set([
      "dr", "dr.", "doctor", "mr", "mr.", "mrs", "mrs.", "ms", "ms.",
      "prof", "prof.", "nurse", "sister", "brother"
    ]);
    const tokens = raw.match(/[a-z0-9]+/g) || [];
    const filtered = tokens.filter((t) => !honorifics.has(t));
    const parts = filtered.length > 0 ? filtered : tokens;
    if (parts.length === 0) return "staff";
    if (parts.length === 1) return parts[0];
    return `${parts[0]}.${parts[parts.length - 1]}`;
  };

  const filterPhoneInput = (val: string): string => {
    return val.replace(/[^0-9+\s\-().]/g, "");
  };

  const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

  const getPhoneWarning = (phone: string, isTouched: boolean = false): string | null => {
    const trimmed = phone.trim();
    if (!trimmed) {
      return isTouched ? "Phone number is required." : null;
    }
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length < 7) {
      return `Must contain at least 7 digits (currently ${digits.length}).`;
    }
    if (digits.length > 15) {
      return `Cannot exceed 15 digits (currently ${digits.length}).`;
    }
    return null;
  };

  const getEmailWarning = (email?: string | null): string | null => {
    if (!email || !email.trim()) return null;
    if (!EMAIL_REGEX.test(email.trim())) {
      return "Please enter a valid email format (e.g. name@example.com).";
    }
    return null;
  };

  const validatePhoneAndEmail = (phone: string, email?: string | null): string | null => {
    const phoneWarn = getPhoneWarning(phone, true);
    if (phoneWarn) return phoneWarn;
    const emailWarn = getEmailWarning(email);
    if (emailWarn) return emailWarn;
    return null;
  };

  // Form states: New Staff
  const [staffFormTouched, setStaffFormTouched] = useState<{ phone?: boolean; email?: boolean }>({});
  const [staffForm, setStaffForm] = useState({
    full_name: "",
    username: "",
    email: "",
    phone: "",
    role: "Doctor",
    speciality: "General Physician",
    department: "Clinical",
    employment_type: "full_time",
    base_salary_rupees: "50000",
    emergency_contact: "",
    notes: "",
    can_login: false,
    password: "",
  });

  // Auto-dismiss alerts
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  // Load staff list
  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await listStaff();
      setStaffList(data || []);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to load staff roster.");
      setStaffList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered staff roster
  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        query === "" ||
        s.full_name.toLowerCase().includes(query) ||
        (s.username && s.username.toLowerCase().includes(query)) ||
        s.role.toLowerCase().includes(query) ||
        s.phone.includes(query) ||
        (s.email && s.email.toLowerCase().includes(query));

      const matchesDept =
        departmentFilter === "All Departments" || s.department === departmentFilter;

      const matchesQuick =
        quickFilter === "all"
          ? true
          : quickFilter === "doctors"
          ? isDoctorRole(s.role)
          : quickFilter === "active"
          ? s.status === "active"
          : quickFilter === "portal"
          ? Boolean(s.can_login)
          : true;

      return matchesSearch && matchesDept && matchesQuick;
    });
  }, [staffList, searchQuery, departmentFilter, quickFilter]);

  // Handle Add Staff
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    const isDoc = isDoctorRole(staffForm.role);
    if (isDoc && !staffForm.speciality?.trim()) {
      setErrorMsg("Specialist field is mandatory for doctors. Please select a speciality.");
      return;
    }

    if (staffForm.can_login && (!staffForm.password || staffForm.password.length < 6)) {
      setErrorMsg("Password must be at least 6 characters long.");
      return;
    }

    const validationErr = validatePhoneAndEmail(staffForm.phone, staffForm.email);
    if (validationErr) {
      setErrorMsg(validationErr);
      return;
    }

    try {
      const paise = Math.round(parseFloat(staffForm.base_salary_rupees || "0") * 100);
      const created = await createStaffMember({
        full_name: staffForm.full_name,
        username: staffForm.username ? staffForm.username.trim().replace(/^@+/, "") : undefined,
        email: staffForm.email ? staffForm.email.trim() : undefined,
        phone: staffForm.phone,
        role: staffForm.role,
        speciality: isDoc ? (staffForm.speciality || "General Physician") : undefined,
        department: staffForm.department,
        employment_type: staffForm.employment_type,
        base_salary_paise: paise,
        emergency_contact: staffForm.emergency_contact || undefined,
        notes: staffForm.notes || undefined,
        can_login: staffForm.can_login,
        password: staffForm.can_login ? staffForm.password : undefined,
      });

      setStaffList((prev) => [created, ...prev]);
      setSuccessMsg(
        created.can_login
          ? `${created.role} ${created.full_name} added with portal User ID ${created.username}.`
          : `${created.role} ${created.full_name} added to staff roster.`
      );
      setIsAddStaffOpen(false);

      // Present credentials modal & retain in session cache
      if (created.can_login && staffForm.password) {
        setRecentPasswords((prev) => ({ ...prev, [created.id]: staffForm.password }));
        setCredentialsModal({
          staffName: created.full_name,
          role: created.role,
          username: created.username || "",
          email: created.email || "",
          password: staffForm.password,
        });
      }

      setStaffForm({
        full_name: "",
        username: "",
        email: "",
        phone: "",
        role: "Doctor",
        speciality: "General Physician",
        department: "Clinical",
        employment_type: "full_time",
        base_salary_rupees: "50000",
        emergency_contact: "",
        notes: "",
        can_login: false,
        password: "",
      });
      loadData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to add staff member.");
    }
  };

  // Handle Admin Reset Staff Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordStaff) return;
    if (!newPasswordInput || newPasswordInput.length < 6) {
      setErrorMsg("New password must be at least 6 characters long.");
      return;
    }
    try {
      await resetStaffPassword(resetPasswordStaff.id, newPasswordInput);
      setSuccessMsg(`Password successfully reset for ${resetPasswordStaff.full_name}.`);

      // Store in session cache & show credentials modal
      setRecentPasswords((prev) => ({ ...prev, [resetPasswordStaff.id]: newPasswordInput }));
      setCredentialsModal({
        staffName: resetPasswordStaff.full_name,
        role: resetPasswordStaff.role,
        username: resetPasswordStaff.username || "",
        email: resetPasswordStaff.email || "",
        password: newPasswordInput,
      });

      setResetPasswordStaff(null);
      setNewPasswordInput("");
      loadData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to reset password.");
    }
  };

  // Handle Update Staff
  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    if (Date.now() - editModeEnteredAt < 500) {
      // Discard accidental click-through / double-click when entering edit mode
      return;
    }

    const originalStaff = staffList.find((s) => s.id === editingStaff.id);
    const hasExistingLogin = Boolean(originalStaff?.can_login && originalStaff?.username);

    const hasChanges = isStaffFormDirty(editingStaff);
    if (!hasChanges) {
      setSuccessMsg(`No changes detected for ${editingStaff.full_name}.`);
      cancelEditingStaff();
      return;
    }

    const validationErr = validatePhoneAndEmail(editingStaff.phone, editingStaff.email);
    if (validationErr) {
      setErrorMsg(validationErr);
      return;
    }

    const isDoc = isDoctorRole(editingStaff.role);
    if (isDoc && !editingStaff.speciality?.trim()) {
      setErrorMsg("Specialist field is mandatory for doctors. Please select a speciality.");
      return;
    }

    if (editingStaff.can_login && !hasExistingLogin && !editPasswordInput) {
      setErrorMsg("A password (min 6 characters) is required when enabling portal login access.");
      return;
    }

    if (editPasswordInput && editPasswordInput.length < 6) {
      setErrorMsg("New password must be at least 6 characters long.");
      return;
    }

    if (!window.confirm(`Save changes for ${editingStaff.full_name}?`)) {
      return;
    }

    try {
      const updated = await updateStaffMember(editingStaff.id, {
        full_name: editingStaff.full_name,
        username: editingStaff.username ? editingStaff.username.trim().replace(/^@+/, "") : undefined,
        email: editingStaff.email ? editingStaff.email.trim() : undefined,
        phone: editingStaff.phone,
        role: editingStaff.role,
        speciality: isDoc ? (editingStaff.speciality || "General Physician") : null,
        department: editingStaff.department,
        employment_type: editingStaff.employment_type,
        status: editingStaff.status,
        base_salary_paise: editingStaff.base_salary_paise,
        emergency_contact: editingStaff.emergency_contact || undefined,
        notes: editingStaff.notes || undefined,
        can_login: editingStaff.can_login,
        password: editPasswordInput ? editPasswordInput : undefined,
      });
      setStaffList((prev) => prev.map((s) => (s.id === editingStaff.id ? updated : s)));
      setSelectedStaff(updated);
      setSuccessMsg(`Details updated for ${updated.full_name}.`);

      // If a new password was provided in edit mode, present it
      if (editPasswordInput) {
        setRecentPasswords((prev) => ({ ...prev, [updated.id]: editPasswordInput }));
        setCredentialsModal({
          staffName: updated.full_name,
          role: updated.role,
          username: updated.username || "",
          email: updated.email || "",
          password: editPasswordInput,
        });
      }

      setEditingStaff(null);
      setEditPasswordInput("");
      loadData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to update staff member.");
    }
  };

  // Handle Delete Staff
  const handleDeleteStaff = async (staffId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove ${name} from clinic roster?`)) return;
    try {
      await deleteStaffMember(staffId);
      setStaffList((prev) => prev.filter((s) => s.id !== staffId));
      if (selectedStaff?.id === staffId) {
        setSelectedStaff(null);
      }
      setSuccessMsg(`${name} removed from roster.`);
      loadData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to remove staff member.");
    }
  };

  const addPhoneWarning = getPhoneWarning(staffForm.phone, Boolean(staffFormTouched.phone || staffForm.phone.length > 0));
  const addEmailWarning = getEmailWarning(staffForm.email);
  const editPhoneWarning = editingStaff ? getPhoneWarning(editingStaff.phone, true) : null;
  const editEmailWarning = editingStaff ? getEmailWarning(editingStaff.email) : null;

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Alert Notices */}
      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
          <button type="button" onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button type="button" onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* =========================================================================
          FULL-SCREEN / FULL-VIEW: ADD STAFF MEMBER
         ========================================================================= */}
      {isAddStaffOpen ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden animate-in fade-in duration-150">
          {/* Header Toolbar */}
          <div className="p-4 sm:p-5 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gradient-to-r from-slate-50/90 via-white to-emerald-50/30">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsAddStaffOpen(false)}
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-white rounded-xl border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                title="Back to Staff Directory"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddStaffOpen(false)}
                    className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  >
                    Staff Directory
                  </button>
                  <span className="text-xs text-slate-300">/</span>
                  <span className="text-xs font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md border border-brand-100">
                    Add New Member
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">Add Staff Member</h2>
                  <span className="hidden sm:inline text-xs text-slate-400 font-normal">
                    — Register new clinic doctors or personnel
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setIsAddStaffOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl border border-slate-200/80 bg-white shadow-2xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="add-staff-form"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-700 hover:bg-brand-800 active:scale-[0.99] text-white text-xs font-semibold rounded-xl shadow-xs hover:shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Staff Member</span>
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="m-4 sm:m-5 mb-0 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
              <button type="button" onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-800">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Form Content in Single Complete Page */}
          <form id="add-staff-form" onSubmit={handleCreateStaff} className="p-4 sm:p-6 space-y-5 text-xs">
            {/* Card 1: Staff Profile & Contact */}
            <div className="bg-slate-50/50 rounded-2xl border border-slate-200/80 p-4 sm:p-5 space-y-4 shadow-2xs">
              <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-200/70">
                <div className="w-7 h-7 rounded-lg bg-brand-50 text-brand-700 border border-brand-100 flex items-center justify-center font-bold shrink-0">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Staff Profile & Contact</h3>
                  <p className="text-[11px] text-slate-500">Personal identity and primary communication channels</p>
                </div>
              </div>

              {/* Row 1: Name, Role, Specialist (Doctor Only), Department */}
              {(() => {
                const isDoctor = isDoctorRole(staffForm.role);
                return (
                  <div
                    className={`grid grid-cols-1 ${
                      isDoctor ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3"
                    } gap-4 sm:gap-5`}
                  >
                    {/* Full Name */}
                    <div>
                      <div className="h-5 flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                          Full Name <span className="text-brand-600">*</span>
                        </label>
                      </div>
                      <div className="relative flex items-center group">
                        <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none group-focus-within:text-brand-600 transition-colors shrink-0" />
                        <input
                          type="text"
                          required
                          placeholder="e.g. Dr. Rajesh Verma or Priya Sharma"
                          value={staffForm.full_name}
                          onChange={(e) => setStaffForm({ ...staffForm, full_name: e.target.value })}
                          className="w-full h-10 pl-11 pr-3.5 bg-white hover:bg-slate-50/50 focus:bg-white border border-slate-200 hover:border-slate-300 focus:border-brand-600 focus:ring-4 focus:ring-brand-500/10 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 transition-all shadow-2xs font-medium"
                        />
                      </div>
                    </div>

                    {/* Role */}
                    <div>
                      <div className="h-5 flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                          Role / Designation <span className="text-brand-600">*</span>
                        </label>
                      </div>
                      <div className="relative flex items-center group">
                        <Stethoscope className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none group-focus-within:text-brand-600 transition-colors shrink-0" />
                        <select
                          value={staffForm.role}
                          onChange={(e) => {
                            const newRole = e.target.value;
                            const isDoc = isDoctorRole(newRole);
                            setStaffForm({
                              ...staffForm,
                              role: newRole,
                              speciality: isDoc ? (staffForm.speciality || "General Physician") : "",
                              department: isDoc ? "Clinical" : staffForm.department,
                            });
                          }}
                          className="w-full h-10 pl-11 pr-9 bg-white hover:bg-slate-50/50 focus:bg-white border border-slate-200 hover:border-slate-300 focus:border-brand-600 focus:ring-4 focus:ring-brand-500/10 rounded-xl text-xs text-slate-900 font-semibold transition-all shadow-2xs appearance-none cursor-pointer"
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none group-focus-within:text-brand-600 transition-colors shrink-0" />
                      </div>
                    </div>

                    {/* Specialist / Medical Speciality (Doctor Only) */}
                    {isDoctor && (
                      <div className="animate-in fade-in duration-150">
                        <div className="h-5 flex items-center justify-between mb-1.5">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-purple-700 flex items-center gap-1">
                            <span>Specialist</span>
                            <span className="text-brand-600">*</span>
                          </label>
                          <span className="text-[10px] text-purple-600 font-semibold bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100">
                            Required
                          </span>
                        </div>
                        <div className="relative flex items-center group">
                          <Stethoscope className="w-4 h-4 text-purple-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none group-focus-within:text-brand-600 transition-colors shrink-0" />
                          <select
                            required
                            value={staffForm.speciality || "General Physician"}
                            onChange={(e) => setStaffForm({ ...staffForm, speciality: e.target.value })}
                            className="w-full h-10 pl-11 pr-9 bg-purple-50/20 hover:bg-white focus:bg-white border border-purple-200 hover:border-purple-300 focus:border-brand-600 focus:ring-4 focus:ring-brand-500/10 rounded-xl text-xs text-slate-900 font-semibold transition-all shadow-2xs appearance-none cursor-pointer"
                          >
                            {SPECIALITY_OPTIONS.map((spec) => (
                              <option key={spec} value={spec}>
                                {spec}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none group-focus-within:text-brand-600 transition-colors shrink-0" />
                        </div>
                      </div>
                    )}

                    {/* Department */}
                    <div>
                      <div className="h-5 flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                          Department <span className="text-brand-600">*</span>
                        </label>
                      </div>
                      <div className="relative flex items-center group">
                        <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none group-focus-within:text-brand-600 transition-colors shrink-0" />
                        <select
                          value={staffForm.department}
                          onChange={(e) => setStaffForm({ ...staffForm, department: e.target.value })}
                          className="w-full h-10 pl-11 pr-9 bg-white hover:bg-slate-50/50 focus:bg-white border border-slate-200 hover:border-slate-300 focus:border-brand-600 focus:ring-4 focus:ring-brand-500/10 rounded-xl text-xs text-slate-900 font-medium transition-all shadow-2xs appearance-none cursor-pointer"
                        >
                          {DEPARTMENT_OPTIONS.filter((d) => d !== "All Departments").map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none group-focus-within:text-brand-600 transition-colors shrink-0" />
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Row 2: Phone & Email */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 pt-1">
                {/* Phone Number */}
                <div>
                  <div className="h-5 flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Phone Number <span className="text-brand-600">*</span>
                    </label>
                  </div>
                  <div className="relative flex items-center group">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none group-focus-within:text-brand-600 transition-colors shrink-0" />
                    <input
                      type="tel"
                      required
                      placeholder="+91 98765 00000"
                      value={staffForm.phone}
                      onBlur={() => setStaffFormTouched((prev) => ({ ...prev, phone: true }))}
                      onChange={(e) => {
                        setStaffFormTouched((prev) => ({ ...prev, phone: true }));
                        setStaffForm({ ...staffForm, phone: filterPhoneInput(e.target.value) });
                      }}
                      className={`w-full h-10 pl-11 pr-3.5 bg-white hover:bg-slate-50/50 focus:bg-white border rounded-xl text-xs font-medium transition-all shadow-2xs ${
                        addPhoneWarning
                          ? "border-rose-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-400/20 bg-rose-50/20 text-rose-900"
                          : "border-slate-200 hover:border-slate-300 focus:border-brand-600 focus:ring-4 focus:ring-brand-500/10 text-slate-900"
                      }`}
                    />
                  </div>
                  {addPhoneWarning && (
                    <p className="mt-1 text-[11px] text-rose-600 flex items-center gap-1 font-medium animate-in fade-in">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                      <span>{addPhoneWarning}</span>
                    </p>
                  )}
                </div>

                {/* Email Address */}
                <div>
                  <div className="h-5 flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Email Address <span className="text-slate-400 font-normal lowercase">(optional)</span>
                    </label>
                  </div>
                  <div className="relative flex items-center group">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none group-focus-within:text-brand-600 transition-colors shrink-0" />
                    <input
                      type="email"
                      placeholder="doctor@clinic.com"
                      value={staffForm.email}
                      onBlur={() => setStaffFormTouched((prev) => ({ ...prev, email: true }))}
                      onChange={(e) => {
                        setStaffFormTouched((prev) => ({ ...prev, email: true }));
                        setStaffForm({ ...staffForm, email: e.target.value });
                      }}
                      className={`w-full h-10 pl-11 pr-3.5 bg-white hover:bg-slate-50/50 focus:bg-white border rounded-xl text-xs font-medium transition-all shadow-2xs ${
                        addEmailWarning
                          ? "border-rose-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-400/20 bg-rose-50/20 text-rose-900"
                          : "border-slate-200 hover:border-slate-300 focus:border-brand-600 focus:ring-4 focus:ring-brand-500/10 text-slate-900"
                      }`}
                    />
                  </div>
                  {addEmailWarning && (
                    <p className="mt-1 text-[11px] text-rose-600 flex items-center gap-1 font-medium animate-in fade-in">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                      <span>{addEmailWarning}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Card 2: Employment & Roster Terms */}
            <div className="bg-slate-50/50 rounded-2xl border border-slate-200/80 p-4 sm:p-5 space-y-4 shadow-2xs">
              <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-200/70">
                <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 border border-teal-100 flex items-center justify-center font-bold shrink-0">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Employment & Roster Terms</h3>
                  <p className="text-[11px] text-slate-500">Employment terms, compensation, and emergency contact</p>
                </div>
              </div>

              {/* Row 1: Employment Type, Monthly Salary, Emergency Contact */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
                {/* Employment Type */}
                <div>
                  <div className="h-5 flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Employment Type
                    </label>
                  </div>
                  <div className="relative flex items-center group">
                    <Briefcase className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none group-focus-within:text-brand-600 transition-colors shrink-0" />
                    <select
                      value={staffForm.employment_type}
                      onChange={(e) => setStaffForm({ ...staffForm, employment_type: e.target.value })}
                      className="w-full h-10 pl-11 pr-9 bg-white hover:bg-slate-50/50 focus:bg-white border border-slate-200 hover:border-slate-300 focus:border-brand-600 focus:ring-4 focus:ring-brand-500/10 rounded-xl text-xs text-slate-900 font-medium transition-all shadow-2xs appearance-none cursor-pointer"
                    >
                      <option value="full_time">Full Time</option>
                      <option value="part_time">Part Time</option>
                      <option value="contract">Contract</option>
                      <option value="shift">Shift Based</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none group-focus-within:text-brand-600 transition-colors shrink-0" />
                  </div>
                </div>

                {/* Monthly Salary */}
                <div>
                  <div className="h-5 flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Monthly Salary (₹)
                    </label>
                  </div>
                  <div className="relative flex items-center group">
                    <CreditCard className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none group-focus-within:text-brand-600 transition-colors shrink-0" />
                    <input
                      type="number"
                      min="0"
                      step="500"
                      placeholder="50000"
                      value={staffForm.base_salary_rupees}
                      onChange={(e) => setStaffForm({ ...staffForm, base_salary_rupees: e.target.value })}
                      className="w-full h-10 pl-11 pr-3.5 bg-white hover:bg-slate-50/50 focus:bg-white border border-slate-200 hover:border-slate-300 focus:border-brand-600 focus:ring-4 focus:ring-brand-500/10 rounded-xl text-xs text-slate-900 font-medium transition-all shadow-2xs"
                    />
                  </div>
                </div>

                {/* Emergency Contact */}
                <div>
                  <div className="h-5 flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Emergency Contact <span className="text-slate-400 font-normal lowercase">(optional)</span>
                    </label>
                  </div>
                  <div className="relative flex items-center group">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none group-focus-within:text-brand-600 transition-colors shrink-0" />
                    <input
                      type="text"
                      placeholder="e.g. Spouse (+91 98765 11111)"
                      value={staffForm.emergency_contact}
                      onChange={(e) => setStaffForm({ ...staffForm, emergency_contact: e.target.value })}
                      className="w-full h-10 pl-11 pr-3.5 bg-white hover:bg-slate-50/50 focus:bg-white border border-slate-200 hover:border-slate-300 focus:border-brand-600 focus:ring-4 focus:ring-brand-500/10 rounded-xl text-xs text-slate-900 font-medium transition-all shadow-2xs"
                    />
                  </div>
                </div>
              </div>

              {/* Row 2: Notes / Specialization */}
              <div className="pt-1">
                <div className="h-5 flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Notes / Specialization <span className="text-slate-400 font-normal lowercase">(optional)</span>
                  </label>
                </div>
                <div className="relative flex items-center group">
                  <FileText className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none group-focus-within:text-brand-600 transition-colors shrink-0" />
                  <input
                    type="text"
                    placeholder="e.g. Consultant physician, OPD morning shift, pediatrician..."
                    value={staffForm.notes}
                    onChange={(e) => setStaffForm({ ...staffForm, notes: e.target.value })}
                    className="w-full h-10 pl-11 pr-3.5 bg-white hover:bg-slate-50/50 focus:bg-white border border-slate-200 hover:border-slate-300 focus:border-brand-600 focus:ring-4 focus:ring-brand-500/10 rounded-xl text-xs text-slate-900 font-medium transition-all shadow-2xs"
                  />
                </div>
              </div>
            </div>

            {/* Card 3: Portal Login Access & Credentials */}
            <div className="bg-slate-50/50 rounded-2xl border border-slate-200/80 p-4 sm:p-5 space-y-4 shadow-2xs">
              <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-200/70">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center font-bold shrink-0">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Portal Login Access</h3>
                  <p className="text-[11px] text-slate-500">Configure Staff User ID & credentials for clinic dashboard login</p>
                </div>
              </div>

              {/* Tactile iOS-Style Switch Container */}
              <div className="p-4 bg-slate-50/70 hover:bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between transition-colors">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold border transition-colors ${
                      staffForm.can_login
                        ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                        : "bg-slate-100 text-slate-500 border-slate-200"
                    }`}
                  >
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-xs">Grant Portal Login Access</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          staffForm.can_login
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                        }`}
                      >
                        {staffForm.can_login ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      Allow staff member to sign in at /login with their Staff User ID
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={staffForm.can_login}
                  onClick={() => setStaffForm({ ...staffForm, can_login: !staffForm.can_login })}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
                    staffForm.can_login ? "bg-brand-600" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      staffForm.can_login ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {staffForm.can_login ? (
                <div className="p-4 sm:p-5 rounded-xl bg-slate-50/60 border border-slate-200/80 space-y-4 animate-in fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* User ID */}
                    <div>
                      <div className="h-5 flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                          Staff User ID <span className="text-slate-400 font-normal lowercase">(optional)</span>
                        </label>
                        <span className="text-[10px] font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
                          Preview: {staffForm.username ? staffForm.username.trim().toLowerCase() : derivePreviewUsername(staffForm.full_name)}
                        </span>
                      </div>
                      <div className="relative flex items-center group">
                        <input
                          type="text"
                          placeholder={staffForm.full_name ? derivePreviewUsername(staffForm.full_name) : "e.g. john.doe"}
                          value={staffForm.username}
                          onChange={(e) => setStaffForm({ ...staffForm, username: e.target.value })}
                          className="w-full h-10 px-3.5 bg-white hover:bg-slate-50/50 focus:bg-white border border-slate-200 hover:border-slate-300 focus:border-brand-600 focus:ring-4 focus:ring-brand-500/10 rounded-xl font-mono text-xs font-semibold text-slate-900 transition-all shadow-2xs"
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Leave blank to auto-generate from name (e.g. <span className="font-mono text-slate-700 font-semibold">{derivePreviewUsername(staffForm.full_name)}</span>).
                      </p>
                    </div>

                    {/* Initial Password */}
                    <div>
                      <div className="h-5 flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                          Initial Password <span className="text-brand-600">*</span>
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1 flex items-center group">
                          <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none group-focus-within:text-brand-600 transition-colors shrink-0" />
                          <input
                            type={showAddPassword ? "text" : "password"}
                            required={staffForm.can_login}
                            placeholder="Minimum 6 characters (e.g. TempPass@123)"
                            value={staffForm.password}
                            onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                            className={`w-full h-10 pl-11 pr-10 bg-white hover:bg-slate-50/50 focus:bg-white border rounded-xl font-mono text-xs transition-all shadow-2xs ${
                              staffForm.password.length > 0 && staffForm.password.length < 6
                                ? "border-rose-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-400/20 bg-rose-50/20 text-rose-900"
                                : "border-slate-200 hover:border-slate-300 focus:border-brand-600 focus:ring-4 focus:ring-brand-500/10 text-slate-900"
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowAddPassword(!showAddPassword)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                            title={showAddPassword ? "Hide password" : "Show password"}
                          >
                            {showAddPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const randomPass = "Clinic@" + Math.random().toString(36).substring(2, 7) + "!";
                            setStaffForm({ ...staffForm, password: randomPass });
                            setShowAddPassword(true);
                          }}
                          className="h-10 px-3.5 inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-2xs hover:shadow-xs transition-all active:scale-[0.98] cursor-pointer shrink-0"
                          title="Generate a secure temporary password"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-blue-100" />
                          <span>Generate</span>
                        </button>
                      </div>
                      {staffForm.password.length > 0 && staffForm.password.length < 6 && (
                        <p className="mt-1 text-[11px] text-rose-600 flex items-center gap-1 font-medium animate-in fade-in">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                          <span>Password must be at least 6 characters (currently {staffForm.password.length}).</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 space-y-1 text-slate-600">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>Staff Portal Access Instructions</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      The staff member will sign in at <code className="text-brand-700 font-semibold">/login</code> on the <strong>Staff</strong> tab using their User ID and password.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Bottom Unified Actions */}
            <div className="pt-4 border-t border-slate-200/80 flex items-center justify-end gap-3 bg-slate-50/50 p-4 sm:p-5 -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 rounded-b-2xl">
              <button
                type="button"
                onClick={() => setIsAddStaffOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer border border-slate-200/80 bg-white shadow-2xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-brand-700 hover:bg-brand-800 active:scale-[0.99] rounded-xl shadow-xs hover:shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Staff Member</span>
              </button>
            </div>
          </form>
        </div>
      ) : editingStaff ? (
        /* =========================================================================
            FULL-SCREEN / FULL-VIEW: EDIT STAFF MEMBER
           ========================================================================= */
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden animate-in fade-in duration-150">
          {/* Header Bar */}
          <div className="p-4 sm:p-5 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gradient-to-r from-slate-50/90 via-white to-emerald-50/30">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={cancelEditingStaff}
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-white rounded-xl border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                title="Back to Staff Profile"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStaff(null);
                      setEditingStaff(null);
                    }}
                    className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  >
                    Staff Directory
                  </button>
                  <span className="text-xs text-slate-300">/</span>
                  <button
                    type="button"
                    onClick={cancelEditingStaff}
                    className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  >
                    Staff Profile
                  </button>
                  <span className="text-xs text-slate-300">/</span>
                  <span className="text-xs font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md border border-brand-100">
                    Edit Staff Details
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">Edit Staff: {editingStaff.full_name}</h2>
                  {editingStaff.username && (
                    <span className="text-[11px] font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
                      {editingStaff.username}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 self-end sm:self-auto">
              <button
                type="button"
                onClick={cancelEditingStaff}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl border border-slate-200/80 bg-white shadow-2xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="edit-staff-form"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-700 hover:bg-brand-800 active:scale-[0.99] text-white text-xs font-semibold rounded-xl shadow-xs hover:shadow-sm transition-all cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="m-4 sm:m-5 mb-0 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
              <button type="button" onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-800">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Unified Form Body */}
          <form id="edit-staff-form" onSubmit={handleUpdateStaff} className="p-4 sm:p-6 space-y-5 text-xs">
            {/* Card 1: Staff Profile & Contact */}
            <div className="bg-slate-50/50 rounded-2xl border border-slate-200/80 p-4 sm:p-5 space-y-4 shadow-2xs">
              <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-200/70">
                <div className="w-7 h-7 rounded-lg bg-brand-50 text-brand-700 border border-brand-100 flex items-center justify-center font-bold shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Staff Profile & Contact</h3>
                  <p className="text-[11px] text-slate-500">Update basic roster information and primary communication channels</p>
                </div>
              </div>

              {/* Row 1: Full Name, Role, Specialist (Doctor Only), Department */}
              {(() => {
                const isEditDoctor = isDoctorRole(editingStaff.role);
                return (
                  <div
                    className={`grid grid-cols-1 ${
                      isEditDoctor ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3"
                    } gap-4 sm:gap-5`}
                  >
                    {/* Full Name */}
                    <div>
                      <div className="h-5 flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                          Full Name <span className="text-brand-600">*</span>
                        </label>
                      </div>
                      <div className="relative flex items-center group">
                        <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none group-focus-within:text-brand-600 transition-colors shrink-0" />
                        <input
                          type="text"
                          required
                          value={editingStaff.full_name}
                          onChange={(e) => setEditingStaff({ ...editingStaff, full_name: e.target.value })}
                          className="w-full h-10 pl-11 pr-3.5 bg-white hover:bg-slate-50/50 focus:bg-white border border-slate-200 hover:border-slate-300 focus:border-brand-600 focus:ring-4 focus:ring-brand-500/10 rounded-xl text-xs text-slate-900 transition-all shadow-2xs font-medium"
                        />
                      </div>
                    </div>

                    {/* Role */}
                    <div>
                      <div className="h-5 flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                          Role / Designation <span className="text-brand-600">*</span>
                        </label>
                      </div>
                      <div className="relative flex items-center group">
                        <Stethoscope className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none group-focus-within:text-brand-600 transition-colors shrink-0" />
                        <select
                          value={editingStaff.role}
                          onChange={(e) => {
                            const newRole = e.target.value;
                            const isDoc = isDoctorRole(newRole);
                            setEditingStaff({
                              ...editingStaff,
                              role: newRole,
                              speciality: isDoc ? (editingStaff.speciality || "General Physician") : undefined,
                              department: isDoc ? "Clinical" : editingStaff.department,
                            });
                          }}
                          className="w-full h-10 pl-11 pr-9 bg-white hover:bg-slate-50/50 focus:bg-white border border-slate-200 hover:border-slate-300 focus:border-brand-600 focus:ring-4 focus:ring-brand-500/10 rounded-xl text-xs text-slate-900 font-semibold transition-all shadow-2xs appearance-none cursor-pointer"
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none group-focus-within:text-brand-600 transition-colors shrink-0" />
                      </div>
                    </div>

                    {/* Specialist / Medical Speciality (Doctor Only) */}
                    {isEditDoctor && (
                      <div className="animate-in fade-in duration-150">
                        <div className="h-5 flex items-center justify-between mb-1.5">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-purple-700 flex items-center gap-1">
                            <span>Specialist</span>
                            <span className="text-brand-600">*</span>
                          </label>
                          <span className="text-[10px] text-purple-600 font-semibold bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100">
                            Required
                          </span>
                        </div>
                        <div className="relative flex items-center group">
                          <Stethoscope className="w-4 h-4 text-purple-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none group-focus-within:text-brand-600 transition-colors shrink-0" />
                          <select
                            required
                            value={editingStaff.speciality || "General Physician"}
                            onChange={(e) => setEditingStaff({ ...editingStaff, speciality: e.target.value })}
                            className="w-full h-10 pl-11 pr-9 bg-purple-50/20 hover:bg-white focus:bg-white border border-purple-200 hover:border-purple-300 focus:border-brand-600 focus:ring-4 focus:ring-brand-500/10 rounded-xl text-xs text-slate-900 font-semibold transition-all shadow-2xs appearance-none cursor-pointer"
                          >
                            {SPECIALITY_OPTIONS.map((spec) => (
                              <option key={spec} value={spec}>
                                {spec}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none group-focus-within:text-brand-600 transition-colors shrink-0" />
                        </div>
                      </div>
                    )}

                    {/* Department */}
                    <div>
                      <div className="h-5 flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                          Department <span className="text-brand-600">*</span>
                        </label>
                      </div>
                      <div className="relative flex items-center group">
                        <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none group-focus-within:text-brand-600 transition-colors shrink-0" />
                        <select
                          value={editingStaff.department}
                          onChange={(e) => setEditingStaff({ ...editingStaff, department: e.target.value })}
                          className="w-full h-10 pl-11 pr-9 bg-white hover:bg-slate-50/50 focus:bg-white border border-slate-200 hover:border-slate-300 focus:border-brand-600 focus:ring-4 focus:ring-brand-500/10 rounded-xl text-xs text-slate-900 font-medium transition-all shadow-2xs appearance-none cursor-pointer"
                        >
                          {DEPARTMENT_OPTIONS.filter((d) => d !== "All Departments").map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none group-focus-within:text-brand-600 transition-colors shrink-0" />
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Row 2: Phone & Email */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 pt-1">
                {/* Phone Number */}
                <div>
                  <div className="h-5 flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Phone Number <span className="text-brand-600">*</span>
                    </label>
                  </div>
                  <div className="relative flex items-center group">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none group-focus-within:text-brand-600 transition-colors shrink-0" />
                    <input
                      type="tel"
                      required
                      value={editingStaff.phone}
                      onChange={(e) => setEditingStaff({ ...editingStaff, phone: filterPhoneInput(e.target.value) })}
                      className={`w-full h-10 pl-11 pr-3.5 bg-white hover:bg-slate-50/50 focus:bg-white border rounded-xl text-xs font-medium transition-all shadow-2xs ${
                        editPhoneWarning
                          ? "border-rose-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-400/20 bg-rose-50/20 text-rose-900"
                          : "border-slate-200 hover:border-slate-300 focus:border-brand-600 focus:ring-4 focus:ring-brand-500/10 text-slate-900"
                      }`}
                    />
                  </div>
                  {editPhoneWarning && (
                    <p className="mt-1 text-[11px] text-rose-600 flex items-center gap-1 font-medium animate-in fade-in">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                      <span>{editPhoneWarning}</span>
                    </p>
                  )}
                </div>

                {/* Email Address */}
                <div>
                  <div className="h-5 flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Email Address <span className="text-slate-400 font-normal lowercase">(optional)</span>
                    </label>
                  </div>
                  <div className="relative flex items-center group">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none group-focus-within:text-brand-600 transition-colors shrink-0" />
                    <input
                      type="email"
                      value={editingStaff.email || ""}
                      onChange={(e) => setEditingStaff({ ...editingStaff, email: e.target.value })}
                      className={`w-full h-10 pl-11 pr-3.5 bg-white hover:bg-slate-50/50 focus:bg-white border rounded-xl text-xs font-medium transition-all shadow-2xs ${
                        editEmailWarning
                          ? "border-rose-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-400/20 bg-rose-50/20 text-rose-900"
                          : "border-slate-200 hover:border-slate-300 focus:border-brand-600 focus:ring-4 focus:ring-brand-500/10 text-slate-900"
                      }`}
                    />
                  </div>
                  {editEmailWarning && (
                    <p className="mt-1 text-[11px] text-rose-600 flex items-center gap-1 font-medium animate-in fade-in">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                      <span>{editEmailWarning}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Card 2: Employment & Roster Terms */}
            <div className="bg-slate-50/50 rounded-2xl border border-slate-200/80 p-4 sm:p-5 space-y-4 shadow-2xs">
              <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-200/70">
                <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 border border-teal-100 flex items-center justify-center font-bold shrink-0">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Employment & Roster Terms</h3>
                  <p className="text-[11px] text-slate-500">Working status, shift terms, compensation, and emergency point of contact</p>
                </div>
              </div>

              {/* Row 1: Status, Type, Salary, Emergency Contact */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                {/* Status */}
                <div>
                  <div className="h-5 flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Roster Status
                    </label>
                  </div>
                  <div className="relative flex items-center group">
                    <UserCheck className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none group-focus-within:text-brand-600 transition-colors shrink-0" />
                    <select
                      value={editingStaff.status}
                      onChange={(e) => setEditingStaff({ ...editingStaff, status: e.target.value })}
                      className="w-full h-10 pl-11 pr-9 bg-white hover:bg-slate-50/50 focus:bg-white border border-slate-200 hover:border-slate-300 focus:border-brand-600 focus:ring-4 focus:ring-brand-500/10 rounded-xl text-xs text-slate-900 font-semibold capitalize transition-all shadow-2xs appearance-none cursor-pointer"
                    >
                      <option value="active">Active</option>
                      <option value="on_leave">On Leave</option>
                      <option value="inactive">Inactive</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none group-focus-within:text-brand-600 transition-colors shrink-0" />
                  </div>
                </div>

                {/* Employment Type */}
                <div>
                  <div className="h-5 flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Employment Type
                    </label>
                  </div>
                  <div className="relative flex items-center group">
                    <Briefcase className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none group-focus-within:text-brand-600 transition-colors shrink-0" />
                    <select
                      value={editingStaff.employment_type}
                      onChange={(e) => setEditingStaff({ ...editingStaff, employment_type: e.target.value })}
                      className="w-full h-10 pl-11 pr-9 bg-white hover:bg-slate-50/50 focus:bg-white border border-slate-200 hover:border-slate-300 focus:border-brand-600 focus:ring-4 focus:ring-brand-500/10 rounded-xl text-xs text-slate-900 font-medium transition-all shadow-2xs appearance-none cursor-pointer"
                    >
                      <option value="full_time">Full Time</option>
                      <option value="part_time">Part Time</option>
                      <option value="contract">Contract</option>
                      <option value="shift">Shift Based</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none group-focus-within:text-brand-600 transition-colors shrink-0" />
                  </div>
                </div>

                {/* Monthly Salary */}
                <div>
                  <div className="h-5 flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Monthly Salary (₹)
                    </label>
                  </div>
                  <div className="relative flex items-center group">
                    <CreditCard className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none group-focus-within:text-brand-600 transition-colors shrink-0" />
                    <input
                      type="number"
                      min="0"
                      step="500"
                      value={Math.round((editingStaff.base_salary_paise ?? 0) / 100)}
                      onChange={(e) =>
                        setEditingStaff({
                          ...editingStaff,
                          base_salary_paise: Math.round(parseFloat(e.target.value || "0") * 100),
                        })
                      }
                      className="w-full h-10 pl-11 pr-3.5 bg-white hover:bg-slate-50/50 focus:bg-white border border-slate-200 hover:border-slate-300 focus:border-brand-600 focus:ring-4 focus:ring-brand-500/10 rounded-xl text-xs text-slate-900 font-medium transition-all shadow-2xs"
                    />
                  </div>
                </div>

                {/* Emergency Contact */}
                <div>
                  <div className="h-5 flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Emergency Contact
                    </label>
                  </div>
                  <div className="relative flex items-center group">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none group-focus-within:text-brand-600 transition-colors shrink-0" />
                    <input
                      type="text"
                      value={editingStaff.emergency_contact || ""}
                      onChange={(e) => setEditingStaff({ ...editingStaff, emergency_contact: e.target.value })}
                      className="w-full h-10 pl-11 pr-3.5 bg-white hover:bg-slate-50/50 focus:bg-white border border-slate-200 hover:border-slate-300 focus:border-brand-600 focus:ring-4 focus:ring-brand-500/10 rounded-xl text-xs text-slate-900 font-medium transition-all shadow-2xs"
                    />
                  </div>
                </div>
              </div>

              {/* Row 2: Notes / Specialization */}
              <div className="pt-1">
                <div className="h-5 flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Notes / Specialization <span className="text-slate-400 font-normal lowercase">(optional)</span>
                  </label>
                </div>
                <div className="relative flex items-center group">
                  <FileText className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none group-focus-within:text-brand-600 transition-colors shrink-0" />
                  <input
                    type="text"
                    value={editingStaff.notes || ""}
                    onChange={(e) => setEditingStaff({ ...editingStaff, notes: e.target.value })}
                    className="w-full h-10 pl-11 pr-3.5 bg-white hover:bg-slate-50/50 focus:bg-white border border-slate-200 hover:border-slate-300 focus:border-brand-600 focus:ring-4 focus:ring-brand-500/10 rounded-xl text-xs text-slate-900 font-medium transition-all shadow-2xs"
                  />
                </div>
              </div>
            </div>

            {/* Card 3: Portal Login Access & Credentials */}
            <div className="bg-slate-50/50 rounded-2xl border border-slate-200/80 p-4 sm:p-5 space-y-4 shadow-2xs">
              <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-200/70">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center font-bold shrink-0">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Portal Login Access</h3>
                  <p className="text-[11px] text-slate-500">Configure Staff User ID & credentials for clinic dashboard login</p>
                </div>
              </div>

              {/* Tactile iOS-Style Switch Container */}
              <div className="p-4 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between transition-colors shadow-2xs">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold border transition-colors ${
                      editingStaff.can_login
                        ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                        : "bg-slate-100 text-slate-500 border-slate-200"
                    }`}
                  >
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-xs">Grant Portal Login Access</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          editingStaff.can_login
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                        }`}
                      >
                        {editingStaff.can_login ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      Allow staff member to sign in at /login with their Staff User ID
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={editingStaff.can_login}
                  onClick={() => setEditingStaff({ ...editingStaff, can_login: !editingStaff.can_login })}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
                    editingStaff.can_login ? "bg-brand-600" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      editingStaff.can_login ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {editingStaff.can_login ? (
                <div className="p-4 sm:p-5 rounded-xl bg-white border border-slate-200/80 space-y-4 animate-in fade-in shadow-2xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* User ID */}
                    <div>
                      <div className="h-5 flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                          Staff User ID
                        </label>
                      </div>
                      <div className="relative flex items-center group">
                        <input
                          type="text"
                          placeholder="e.g. john.doe"
                          value={editingStaff.username || ""}
                          onChange={(e) => setEditingStaff({ ...editingStaff, username: e.target.value })}
                          className="w-full h-10 px-3.5 bg-white hover:bg-slate-50/50 focus:bg-white border border-slate-200 hover:border-slate-300 focus:border-brand-600 focus:ring-4 focus:ring-brand-500/10 rounded-xl font-mono text-xs font-semibold text-slate-900 transition-all shadow-2xs"
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Unique alphanumeric User ID used to log in at <code className="text-brand-700 font-semibold">/login</code>.
                      </p>
                    </div>

                    <div>
                      <div className="h-5 flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                          Set / Change Password
                        </label>
                      </div>
                      {(() => {
                        const originalStaff = staffList.find((s) => s.id === editingStaff.id);
                        const hasExistingLogin = Boolean(originalStaff?.can_login && originalStaff?.username);
                        return (
                          <>
                            <div className="flex items-center gap-2">
                              <div className="relative flex-1 flex items-center group">
                                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none group-focus-within:text-brand-600 transition-colors shrink-0" />
                                <input
                                  type={showAddPassword ? "text" : "password"}
                                  placeholder={
                                    hasExistingLogin
                                      ? "Leave blank to keep unchanged (min 6 chars to change)"
                                      : "Enter a password (min 6 characters) - required for login access"
                                  }
                                  value={editPasswordInput}
                                  onChange={(e) => setEditPasswordInput(e.target.value)}
                                  className={`w-full h-10 pl-11 pr-10 bg-white hover:bg-slate-50/50 focus:bg-white border rounded-xl font-mono text-xs transition-all shadow-2xs ${
                                    editPasswordInput.length > 0 && editPasswordInput.length < 6
                                      ? "border-rose-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-400/20 bg-rose-50/20 text-rose-900"
                                      : "border-slate-200 hover:border-slate-300 focus:border-brand-600 focus:ring-4 focus:ring-brand-500/10 text-slate-900"
                                  }`}
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowAddPassword(!showAddPassword)}
                                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                                  title={showAddPassword ? "Hide password" : "Show password"}
                                >
                                  {showAddPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const randomPass = "Clinic@" + Math.random().toString(36).substring(2, 7) + "!";
                                  setEditPasswordInput(randomPass);
                                  setShowAddPassword(true);
                                }}
                                className="h-10 px-3.5 inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-2xs hover:shadow-xs transition-all active:scale-[0.98] cursor-pointer shrink-0"
                                title="Generate a secure temporary password"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-blue-100" />
                                <span>Generate</span>
                              </button>
                            </div>
                            {editPasswordInput.length > 0 && editPasswordInput.length < 6 && (
                              <p className="mt-1 text-[11px] text-rose-600 flex items-center gap-1 font-medium animate-in fade-in">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                                <span>Password must be at least 6 characters (currently {editPasswordInput.length}).</span>
                              </p>
                            )}
                            <p className="mt-1 text-[11px] text-slate-500 leading-tight">
                              {hasExistingLogin
                                ? "Passwords are cryptographically hashed. Leave blank to keep existing password."
                                : "A password is required so the staff member can sign in to the portal."}
                            </p>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Bottom Unified Actions */}
            <div className="pt-4 border-t border-slate-200/80 flex items-center justify-end gap-3 bg-slate-50/50 p-4 sm:p-5 -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 rounded-b-2xl">
              <button
                type="button"
                onClick={cancelEditingStaff}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer border border-slate-200/80 bg-white shadow-2xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-brand-700 hover:bg-brand-800 active:scale-[0.99] rounded-xl shadow-xs hover:shadow-sm transition-all cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </button>
            </div>
          </form>
        </div>
      ) : selectedStaff ? (
        /* =========================================================================
            FULL-SCREEN / FULL-VIEW: VIEW STAFF PROFILE (SINGLE UNIFIED PAGE)
           ========================================================================= */
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden animate-in fade-in duration-150">
          {/* Header Bar */}
          <div className="p-4 sm:p-6 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-slate-50/90 via-white to-emerald-50/30">
            <div className="flex items-center gap-3.5">
              <button
                type="button"
                onClick={() => setSelectedStaff(null)}
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-white rounded-xl border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                title="Back to Staff Directory"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-3.5">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-base border shadow-2xs ring-4 ${
                    isDoctorRole(selectedStaff.role)
                      ? "bg-purple-100 text-purple-700 border-purple-200 ring-purple-500/10"
                      : "bg-brand-50 text-brand-700 border-brand-100 ring-brand-500/10"
                  }`}
                >
                  {isDoctorRole(selectedStaff.role) ? (
                    <Stethoscope className="w-6 h-6" />
                  ) : (
                    selectedStaff.full_name.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedStaff(null)}
                      className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    >
                      Staff Directory
                    </button>
                    <span className="text-xs text-slate-300">/</span>
                    <span className="text-xs font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md border border-brand-100">
                      {selectedStaff.role}
                    </span>
                    {selectedStaff.speciality && (
                      <>
                        <span className="text-xs text-slate-300">/</span>
                        <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                          {selectedStaff.speciality}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <h2 className="text-xl font-bold text-slate-900 tracking-tight leading-tight">
                      {selectedStaff.full_name}
                    </h2>
                    {selectedStaff.username && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 font-semibold">
                        {selectedStaff.username}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => handleDeleteStaff(selectedStaff.id, selectedStaff.full_name)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 text-xs font-semibold rounded-xl border border-rose-200 hover:border-rose-300 shadow-2xs transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove Staff</span>
              </button>
              <button
                type="button"
                onClick={() => startEditingStaff(selectedStaff)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-700 hover:bg-brand-800 active:scale-[0.99] text-white text-xs font-semibold rounded-xl shadow-xs hover:shadow-sm transition-all cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>
            </div>
          </div>

          {/* Quick Stats Banner Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 p-4 sm:p-5 bg-slate-50/70 border-b border-slate-200/80 text-xs">
            <div className="p-3.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Department</span>
                <span className="text-sm font-bold text-slate-900 mt-0.5 block">{selectedStaff.department}</span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-700 border border-brand-100 flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
            <div className="p-3.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Employment</span>
                <span className="text-sm font-bold text-slate-900 capitalize mt-0.5 block">
                  {selectedStaff.employment_type.replace("_", " ")}
                </span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 border border-teal-100 flex items-center justify-center shrink-0">
                <Briefcase className="w-4 h-4" />
              </div>
            </div>
            <div className="p-3.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Monthly Salary</span>
                <span className="text-sm font-bold text-slate-900 mt-0.5 block">
                  {selectedStaff.base_salary_paise && selectedStaff.base_salary_paise > 0 ? formatINR(selectedStaff.base_salary_paise) : "—"}
                </span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center shrink-0">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <div className="p-3.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Joined Date</span>
                <span className="text-sm font-bold text-slate-900 mt-0.5 block">{selectedStaff.joining_date}</span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Body Content */}
          <div className="p-4 sm:p-6 space-y-6 text-xs">
            {/* Section 1: Personal & Contact Information */}
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-100">
                <div className="w-7 h-7 rounded-lg bg-brand-50 text-brand-700 border border-brand-100 flex items-center justify-center font-bold">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Personal & Contact Information</h3>
                  <p className="text-[11px] text-slate-500">Contact details and clinic profile information</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Phone Number</span>
                    <a
                      href={`tel:${selectedStaff.phone}`}
                      className="text-xs font-bold text-slate-900 hover:text-brand-700 mt-1 block transition-colors"
                    >
                      {selectedStaff.phone}
                    </a>
                  </div>
                  <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-center justify-between">
                  <div className="min-w-0 pr-2">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Email Address</span>
                    {selectedStaff.email ? (
                      <a
                        href={`mailto:${selectedStaff.email}`}
                        className="text-xs font-bold text-slate-900 hover:text-brand-700 mt-1 block truncate transition-colors"
                      >
                        {selectedStaff.email}
                      </a>
                    ) : (
                      <span className="text-xs font-bold text-slate-400 mt-1 block">—</span>
                    )}
                  </div>
                  <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Duty Status</span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="relative flex h-2 w-2">
                        {selectedStaff.status === "active" && (
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        )}
                        <span
                          className={`relative inline-flex rounded-full h-2 w-2 ${
                            selectedStaff.status === "active"
                              ? "bg-emerald-500"
                              : selectedStaff.status === "on_leave"
                              ? "bg-amber-500"
                              : "bg-slate-400"
                          }`}
                        />
                      </span>
                      <span className="font-bold text-slate-800 capitalize">{selectedStaff.status.replace("_", " ")}</span>
                    </div>
                  </div>
                  <UserCheck className="w-4 h-4 text-slate-400 shrink-0" />
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-center justify-between">
                  <div className="min-w-0 pr-2">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Emergency Contact</span>
                    <span className="text-xs font-bold text-slate-900 mt-1 block truncate">
                      {selectedStaff.emergency_contact || "—"}
                    </span>
                  </div>
                  <ShieldAlert className="w-4 h-4 text-slate-400 shrink-0" />
                </div>
              </div>

              {selectedStaff.notes && (
                <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200/80 flex items-start gap-3">
                  <FileText className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider mb-0.5">
                      Notes / Clinical Specialization
                    </span>
                    <p className="text-slate-700 leading-relaxed text-xs font-medium">{selectedStaff.notes}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Section 2: Portal Login Access & Credentials */}
            <div className="pt-5 border-t border-slate-200/80 space-y-4">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center font-bold">
                    <Key className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Portal Login Access</h3>
                    <p className="text-[11px] text-slate-500">Staff dashboard credentials & security status</p>
                  </div>
                </div>

                {selectedStaff.can_login && (
                  <button
                    type="button"
                    onClick={() => {
                      setResetPasswordStaff(selectedStaff);
                      setNewPasswordInput("");
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-brand-700 bg-white border border-brand-200 hover:bg-brand-50 rounded-xl shadow-2xs transition-colors cursor-pointer"
                  >
                    Reset Password
                  </button>
                )}
              </div>

              {selectedStaff.can_login ? (
                <div className="p-4 sm:p-5 rounded-xl bg-slate-50/60 border border-slate-200/80 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* User ID Banner with Copy */}
                    <div className="p-4 bg-white rounded-xl border border-emerald-200 flex items-center justify-between shadow-2xs">
                      <div>
                        <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                          Staff User ID
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-mono text-sm font-bold text-slate-900 bg-emerald-50/80 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                            {selectedStaff.username}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => copyToClipboard(selectedStaff.username || "", "fullscreen-profile-id")}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-800 text-xs font-semibold rounded-lg border border-emerald-300 shadow-2xs transition-all cursor-pointer hover:shadow-xs"
                      >
                        {copiedStaffId === "fullscreen-profile-id" ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="font-bold text-emerald-700">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Copy ID</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Password Set this session (if available) */}
                    {recentPasswords[selectedStaff.id] ? (
                      <div className="p-4 bg-white border border-emerald-200 rounded-xl text-emerald-950 flex items-center justify-between shadow-2xs">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                            Password Set This Session
                          </span>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-mono text-xs font-bold text-slate-900 bg-emerald-50/80 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                              {showRecentPassword ? recentPasswords[selectedStaff.id] : "••••••••••••"}
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowRecentPassword(!showRecentPassword)}
                              className="text-emerald-700 hover:text-emerald-900 p-0.5 rounded cursor-pointer"
                              title={showRecentPassword ? "Hide password" : "Show password"}
                            >
                              {showRecentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            copyToClipboard(recentPasswords[selectedStaff.id], "drawer-pass");
                            setSuccessMsg("Password copied to clipboard!");
                          }}
                          className="px-3 py-1.5 bg-white border border-emerald-200 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-lg shadow-2xs flex items-center gap-1 cursor-pointer"
                        >
                          {copiedStaffId === "drawer-pass" ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700 font-bold">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy Pass</span>
                            </>
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="p-4 bg-white border border-slate-200/80 rounded-xl flex items-center gap-3 text-slate-500 shadow-2xs">
                        <Lock className="w-5 h-5 text-slate-400 shrink-0" />
                        <span className="text-xs">Password is securely hashed. Use Reset Password above to assign a new one.</span>
                      </div>
                    )}
                  </div>

                  <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 space-y-1 text-slate-600">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>Portal Sign In Instructions</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Staff members sign in at <code className="text-brand-700 font-semibold">/login</code> on the <strong>Staff</strong> tab using their User ID (<code>{selectedStaff.username}</code>) and assigned password.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-slate-500">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center font-bold border border-slate-200">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">No Portal Login Access</p>
                      <p className="text-[11px] text-slate-500">This staff member cannot log in to the clinic dashboard.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => startEditingStaff(selectedStaff)}
                    className="px-3.5 py-1.5 text-xs font-semibold text-brand-700 bg-white border border-brand-200 hover:bg-brand-50 rounded-xl shadow-2xs transition-colors cursor-pointer self-start sm:self-auto"
                  >
                    Grant Login Access
                  </button>
                </div>
              )}
            </div>

            {/* Bottom Unified Actions */}
            <div className="pt-4 border-t border-slate-200/80 flex items-center justify-between bg-slate-50/50 p-4 sm:p-5 -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 rounded-b-2xl">
              <button
                type="button"
                onClick={() => setSelectedStaff(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5 border border-slate-200/80 bg-white shadow-2xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Directory</span>
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => handleDeleteStaff(selectedStaff.id, selectedStaff.full_name)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 text-xs font-semibold rounded-xl border border-rose-200 hover:border-rose-300 shadow-2xs transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Staff</span>
                </button>
                <button
                  type="button"
                  onClick={() => startEditingStaff(selectedStaff)}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-brand-700 hover:bg-brand-800 active:scale-[0.99] text-white text-xs font-semibold rounded-xl shadow-xs hover:shadow-sm transition-all cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Profile</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* =========================================================================
            DEFAULT: STAFF DIRECTORY TABLE & EXECUTIVE DASHBOARD
           ========================================================================= */
        <div className="space-y-4">
          {/* Executive Roster Summary KPI Strip (Unified Modern Bar) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
              <button
                type="button"
                onClick={() => setQuickFilter("all")}
                className={`p-3.5 sm:p-4 text-left transition-all cursor-pointer group ${
                  quickFilter === "all" ? "bg-slate-50/90 ring-1 ring-inset ring-slate-200" : "hover:bg-slate-50/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Total Roster
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Users className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                    {staffList.length}
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">clinic members</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setQuickFilter("doctors")}
                className={`p-3.5 sm:p-4 text-left transition-all cursor-pointer group ${
                  quickFilter === "doctors" ? "bg-purple-50/70 ring-1 ring-inset ring-purple-200" : "hover:bg-slate-50/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">
                    Doctors & Specialists
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Stethoscope className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                    {staffList.filter((s) => isDoctorRole(s.role)).length}
                  </span>
                  <span className="text-[11px] text-purple-700 font-semibold">care providers</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setQuickFilter("active")}
                className={`p-3.5 sm:p-4 text-left transition-all cursor-pointer group ${
                  quickFilter === "active" ? "bg-teal-50/70 ring-1 ring-inset ring-teal-200" : "hover:bg-slate-50/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider block">
                    Active On Duty
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <UserCheck className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                    {staffList.filter((s) => s.status === "active").length}
                  </span>
                  <span className="text-[11px] text-teal-700 font-semibold">active shifts</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setQuickFilter("portal")}
                className={`p-3.5 sm:p-4 text-left transition-all cursor-pointer group ${
                  quickFilter === "portal" ? "bg-emerald-50/70 ring-1 ring-inset ring-emerald-200" : "hover:bg-slate-50/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                    Portal Sign-In
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Key className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                    {staffList.filter((s) => s.can_login).length}
                  </span>
                  <span className="text-[11px] text-emerald-700 font-semibold">login enabled</span>
                </div>
              </button>
            </div>
          </div>

          {/* Directory Table Container */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            {/* Minimalist Executive Toolbar */}
            <div className="p-4 sm:p-4.5 border-b border-slate-200/80 flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-gradient-to-r from-slate-50/80 via-white to-transparent">
              {/* 1-Click Quick Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setQuickFilter("all")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    quickFilter === "all"
                      ? "bg-slate-900 text-white shadow-2xs"
                      : "bg-slate-100 hover:bg-slate-200/80 text-slate-600"
                  }`}
                >
                  All ({staffList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setQuickFilter("doctors")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    quickFilter === "doctors"
                      ? "bg-purple-700 text-white shadow-2xs"
                      : "bg-slate-100 hover:bg-slate-200/80 text-slate-600"
                  }`}
                >
                  Doctors ({staffList.filter((s) => isDoctorRole(s.role)).length})
                </button>
                <button
                  type="button"
                  onClick={() => setQuickFilter("active")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    quickFilter === "active"
                      ? "bg-teal-700 text-white shadow-2xs"
                      : "bg-slate-100 hover:bg-slate-200/80 text-slate-600"
                  }`}
                >
                  Active ({staffList.filter((s) => s.status === "active").length})
                </button>
                <button
                  type="button"
                  onClick={() => setQuickFilter("portal")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    quickFilter === "portal"
                      ? "bg-emerald-700 text-white shadow-2xs"
                      : "bg-slate-100 hover:bg-slate-200/80 text-slate-600"
                  }`}
                >
                  Sign-In ({staffList.filter((s) => s.can_login).length})
                </button>
              </div>

              {/* Right Side: Search + Department + Refresh + Add Staff */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Search Input */}
                <div className="relative flex items-center group flex-1 sm:flex-initial">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-600 transition-colors pointer-events-none shrink-0" />
                  <input
                    type="text"
                    placeholder="Search staff, role, ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 pl-9 pr-3 text-xs bg-slate-50/70 hover:bg-white focus:bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-slate-800 focus:outline-hidden focus:ring-4 focus:ring-brand-500/10 focus:border-brand-600 w-full sm:w-48 shadow-2xs transition-all font-medium placeholder:text-slate-400"
                  />
                </div>

                {/* Department Filter */}
                <div className="relative flex items-center shrink-0">
                  <select
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    className="h-9 pl-3 pr-8 text-xs bg-slate-50/70 hover:bg-white focus:bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-slate-700 focus:outline-hidden focus:ring-4 focus:ring-brand-500/10 shadow-2xs transition-all font-medium appearance-none cursor-pointer"
                  >
                    {DEPARTMENT_OPTIONS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                {/* Refresh */}
                <button
                  type="button"
                  onClick={loadData}
                  title="Refresh Roster"
                  className="h-9 w-9 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200/80 bg-white shadow-2xs transition-colors cursor-pointer shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                </button>

                {/* Add Staff Button */}
                <button
                  type="button"
                  onClick={() => setIsAddStaffOpen(true)}
                  className="h-9 inline-flex items-center gap-1.5 px-3.5 bg-brand-700 hover:bg-brand-800 active:scale-[0.99] text-white text-xs font-semibold rounded-xl shadow-xs hover:shadow-sm transition-all cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Staff</span>
                </button>
              </div>
            </div>

            {/* Classic Clean Table View */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200/80">
                  <tr>
                    <th className="py-3.5 px-4">Staff Member</th>
                    <th className="py-3.5 px-4">Role / Designation</th>
                    <th className="py-3.5 px-4">Department</th>
                    <th className="py-3.5 px-4">Phone Number</th>
                    <th className="py-3.5 px-4">Duty Status</th>
                    <th className="py-3.5 px-4 text-right">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStaff.map((staff) => {
                    const isDoctor = isDoctorRole(staff.role);
                    return (
                      <tr
                        key={staff.id}
                        onClick={() => setSelectedStaff(staff)}
                        className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                      >
                        {/* Name + Avatar */}
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border shadow-2xs ${
                                isDoctor
                                  ? "bg-purple-100 text-purple-700 border-purple-200"
                                  : "bg-brand-50 text-brand-700 border-brand-100"
                              }`}
                            >
                              {isDoctor ? (
                                <Stethoscope className="w-4.5 h-4.5" />
                              ) : (
                                staff.full_name.charAt(0).toUpperCase()
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 group-hover:text-brand-700 transition-colors">
                                {staff.full_name}
                              </div>
                              {staff.username ? (
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[11px] font-mono text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/70 font-medium leading-none">
                                    {staff.username}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      copyToClipboard(staff.username || "", `table-${staff.id}`);
                                    }}
                                    title="Copy Staff User ID"
                                    className="p-0.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
                                  >
                                    {copiedStaffId === `table-${staff.id}` ? (
                                      <Check className="w-3 h-3 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                              ) : staff.email ? (
                                <div className="text-[11px] text-slate-400 font-normal">
                                  {staff.email}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col items-start gap-1">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                                isDoctor
                                  ? "bg-purple-50 text-purple-700 border-purple-200 font-bold"
                                  : "bg-slate-100 text-slate-700 border-slate-200"
                              }`}
                            >
                              {staff.role}
                            </span>
                            {staff.speciality && (
                              <span className="text-[10px] font-semibold text-purple-600 bg-purple-50/60 px-2 py-0.5 rounded border border-purple-100 inline-block">
                                {staff.speciality}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Department */}
                        <td className="py-3.5 px-4 text-slate-700 font-medium">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            <span>{staff.department}</span>
                          </div>
                        </td>

                        {/* Phone */}
                        <td className="py-3.5 px-4 text-slate-700 font-medium">
                          {staff.phone}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 text-xs text-slate-800 font-medium">
                              <span className="relative flex h-2 w-2">
                                {staff.status === "active" && (
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                )}
                                <span
                                  className={`relative inline-flex rounded-full h-2 w-2 ${
                                    staff.status === "active"
                                      ? "bg-emerald-500"
                                      : staff.status === "on_leave"
                                      ? "bg-amber-500"
                                      : "bg-slate-400"
                                  }`}
                                />
                              </span>
                              <span className="capitalize">{staff.status.replace("_", " ")}</span>
                            </span>
                            {staff.can_login && (
                              <span
                                title="Portal Login Access Active"
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200"
                              >
                                <Key className="w-2.5 h-2.5 text-emerald-600" />
                                <span>Login</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* View Action */}
                        <td className="py-3.5 px-4 text-right">
                          <span className="text-slate-400 group-hover:text-brand-700 inline-flex items-center gap-1 text-xs font-semibold transition-colors">
                            <span>View</span>
                            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                          </span>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredStaff.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-xs font-medium text-slate-600">No staff members found.</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Click &quot;Add Staff&quot; above to register clinic doctors or personnel.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          RESET PASSWORD MODAL (Admin action)
         ========================================================================= */}
      {resetPasswordStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-brand-600" />
                <h3 className="text-sm font-bold text-slate-900">Reset Portal Password</h3>
              </div>
              <button
                type="button"
                onClick={() => setResetPasswordStaff(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Set a new temporary password for <strong>{resetPasswordStaff.full_name}</strong>.
            </p>

            <form onSubmit={handleResetPassword} className="space-y-3 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-slate-700 font-semibold">New Password *</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Minimum 6 characters"
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    className="flex-1 h-10 px-3.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 hover:border-slate-300 rounded-xl focus:outline-hidden focus:ring-4 focus:ring-brand-500/10 focus:border-brand-600 font-mono text-xs shadow-2xs transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const randomPass = "Clinic@" + Math.random().toString(36).substring(2, 7) + "!";
                      setNewPasswordInput(randomPass);
                    }}
                    className="h-10 px-3.5 inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-2xs hover:shadow-xs transition-all active:scale-[0.98] cursor-pointer shrink-0"
                    title="Generate a secure temporary password"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-blue-100" />
                    <span>Generate</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setResetPasswordStaff(null)}
                  className="h-9 px-3.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl border border-slate-200/80 bg-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-9 px-4 text-xs font-semibold text-white bg-brand-700 hover:bg-brand-800 rounded-xl shadow-xs hover:shadow-sm transition-all cursor-pointer"
                >
                  Save New Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          CREDENTIALS ISSUED CONFIRMATION MODAL
         ========================================================================= */}
      {credentialsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Portal Credentials Issued</h3>
                  <p className="text-xs text-slate-500">Access granted for {credentialsModal.staffName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCredentialsModal(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 font-medium">Portal URL:</span>
                <span className="font-semibold text-slate-800">/login (Staff tab)</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">Staff User ID:</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-900 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                    {credentialsModal.username || credentialsModal.email}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const uid = credentialsModal.username || credentialsModal.email || "";
                      copyToClipboard(uid, "modal-id");
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-white hover:bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300 shadow-2xs transition-colors cursor-pointer"
                  >
                    {copiedStaffId === "modal-id" ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-700 font-bold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 text-emerald-700" />
                        <span>Copy ID</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
              {credentialsModal.email && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-medium">Email:</span>
                  <span className="font-medium text-slate-700 font-mono">{credentialsModal.email}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-200/60">
                <span className="text-slate-500 font-medium">Temporary Password:</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-emerald-800 bg-white px-2 py-0.5 rounded border border-emerald-200 font-mono text-sm">
                    {credentialsModal.password}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(credentialsModal.password, "modal-pass")}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-white hover:bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300 shadow-2xs transition-colors cursor-pointer"
                  >
                    {copiedStaffId === "modal-pass" ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-700 font-bold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 text-emerald-700" />
                        <span>Copy Pass</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-2 text-xs text-amber-800">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                <strong>Important:</strong> Copy these credentials now. For HIPAA & security compliance, passwords are encrypted and cannot be viewed in plain text after leaving this screen.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  const uid = credentialsModal.username || credentialsModal.email || "";
                  const shareText = `Clinic Portal Login Credentials:\nStaff Member: ${credentialsModal.staffName} (${credentialsModal.role})\nPortal: Staff Login (/login)\nUser ID: ${uid}\nPassword: ${credentialsModal.password}`;
                  navigator.clipboard.writeText(shareText);
                  setCopiedCredentials(true);
                  setTimeout(() => setCopiedCredentials(false), 3000);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-semibold rounded-xl border border-brand-200 transition-colors cursor-pointer"
              >
                {copiedCredentials ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copiedCredentials ? "Copied to Clipboard!" : "Copy Credentials"}</span>
              </button>

              <button
                type="button"
                onClick={() => setCredentialsModal(null)}
                className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-black rounded-xl transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
