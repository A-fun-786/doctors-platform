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
  UserCheck,
  Calendar,
  DollarSign,
  ShieldAlert,
} from "lucide-react";
import {
  DoctorMeResponse,
  StaffMember,
  listStaff,
  createStaffMember,
  updateStaffMember,
  deleteStaffMember,
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

  // Modals state
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);

  // Form states: New Staff
  const [staffForm, setStaffForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    role: "Doctor",
    department: "Clinical",
    employment_type: "full_time",
    base_salary_rupees: "50000",
    emergency_contact: "",
    notes: "",
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
        s.role.toLowerCase().includes(query) ||
        s.phone.includes(query) ||
        (s.email && s.email.toLowerCase().includes(query));

      const matchesDept =
        departmentFilter === "All Departments" || s.department === departmentFilter;
      return matchesSearch && matchesDept;
    });
  }, [staffList, searchQuery, departmentFilter]);

  // Handle Add Staff
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const paise = Math.round(parseFloat(staffForm.base_salary_rupees || "0") * 100);
      const created = await createStaffMember({
        full_name: staffForm.full_name,
        email: staffForm.email || undefined,
        phone: staffForm.phone,
        role: staffForm.role,
        department: staffForm.department,
        employment_type: staffForm.employment_type,
        base_salary_paise: paise,
        emergency_contact: staffForm.emergency_contact || undefined,
        notes: staffForm.notes || undefined,
      });

      setStaffList((prev) => [created, ...prev]);
      setSuccessMsg(`${created.role} ${created.full_name} added to staff roster.`);
      setIsAddStaffOpen(false);
      setStaffForm({
        full_name: "",
        email: "",
        phone: "",
        role: "Doctor",
        department: "Clinical",
        employment_type: "full_time",
        base_salary_rupees: "50000",
        emergency_contact: "",
        notes: "",
      });
      loadData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to add staff member.");
    }
  };

  // Handle Update Staff
  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    try {
      const updated = await updateStaffMember(editingStaff.id, {
        full_name: editingStaff.full_name,
        email: editingStaff.email || undefined,
        phone: editingStaff.phone,
        role: editingStaff.role,
        department: editingStaff.department,
        employment_type: editingStaff.employment_type,
        status: editingStaff.status,
        base_salary_paise: editingStaff.base_salary_paise,
        emergency_contact: editingStaff.emergency_contact || undefined,
        notes: editingStaff.notes || undefined,
      });
      setStaffList((prev) => prev.map((s) => (s.id === editingStaff.id ? updated : s)));
      if (selectedStaff?.id === updated.id) {
        setSelectedStaff(updated);
      }
      setSuccessMsg(`Details updated for ${updated.full_name}.`);
      setEditingStaff(null);
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

      {/* Classic Card Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Classic Header Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-bold text-slate-900">Manage Staff</h2>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                {staffList.length} members
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Clinic doctors, nurses, and administrative personnel
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search staff..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-brand-500 w-44 sm:w-56 transition-colors"
              />
            </div>

            {/* Department Filter */}
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:bg-white focus:outline-hidden"
            >
              {DEPARTMENT_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            {/* Refresh */}
            <button
              type="button"
              onClick={loadData}
              title="Refresh Roster"
              className="p-1.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>

            {/* Add Staff Button */}
            <button
              type="button"
              onClick={() => setIsAddStaffOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-brand-700 hover:bg-brand-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Staff</span>
            </button>
          </div>
        </div>

        {/* Classic Clean Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Staff Member</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Phone Number</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStaff.map((staff) => {
                const isDoctor = staff.role.toLowerCase().includes("doctor");
                return (
                  <tr
                    key={staff.id}
                    onClick={() => setSelectedStaff(staff)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  >
                    {/* Name + Avatar */}
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border ${
                            isDoctor
                              ? "bg-purple-100 text-purple-700 border-purple-200"
                              : "bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          {isDoctor ? (
                            <Stethoscope className="w-4 h-4" />
                          ) : (
                            staff.full_name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 group-hover:text-brand-700 transition-colors">
                            {staff.full_name}
                          </div>
                          {staff.email && (
                            <div className="text-[11px] text-slate-400 font-normal">
                              {staff.email}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          isDoctor
                            ? "bg-purple-50 text-purple-700 border border-purple-200 font-bold"
                            : "bg-slate-100 text-slate-700 border border-slate-200"
                        }`}
                      >
                        {staff.role}
                      </span>
                    </td>

                    {/* Department */}
                    <td className="py-3.5 px-4 text-slate-600 font-medium">
                      {staff.department}
                    </td>

                    {/* Phone */}
                    <td className="py-3.5 px-4 text-slate-600">
                      {staff.phone}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            staff.status === "active"
                              ? "bg-emerald-500"
                              : staff.status === "on_leave"
                              ? "bg-amber-500"
                              : "bg-slate-400"
                          }`}
                        />
                        <span className="capitalize">{staff.status.replace("_", " ")}</span>
                      </span>
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-right">
                      <span className="text-slate-400 group-hover:text-brand-700 inline-flex items-center gap-1 text-xs font-semibold">
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

      {/* =========================================================================
          CLASSIC PROFILE MODAL: Visible only when a staff member row is clicked
         ========================================================================= */}
      {selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm border ${
                    selectedStaff.role.toLowerCase().includes("doctor")
                      ? "bg-purple-100 text-purple-700 border-purple-200"
                      : "bg-brand-50 text-brand-700 border-brand-100"
                  }`}
                >
                  {selectedStaff.role.toLowerCase().includes("doctor") ? (
                    <Stethoscope className="w-5 h-5" />
                  ) : (
                    selectedStaff.full_name.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {selectedStaff.full_name}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs font-semibold text-brand-700">
                      {selectedStaff.role}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-xs text-slate-500">{selectedStaff.department}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedStaff(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Profile Grid */}
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-400 block font-medium">PHONE NUMBER</span>
                <span className="font-semibold text-slate-800">{selectedStaff.phone}</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-400 block font-medium">EMAIL ADDRESS</span>
                <span className="font-semibold text-slate-800 truncate block">
                  {selectedStaff.email || "—"}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-400 block font-medium">EMPLOYMENT TYPE</span>
                <span className="font-semibold text-slate-800 capitalize">
                  {selectedStaff.employment_type.replace("_", " ")}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-400 block font-medium">MONTHLY SALARY</span>
                <span className="font-semibold text-slate-900">
                  {selectedStaff.base_salary_paise > 0
                    ? formatINR(selectedStaff.base_salary_paise)
                    : "—"}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-400 block font-medium">DATE JOINED</span>
                <span className="font-semibold text-slate-800">{selectedStaff.joining_date}</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-400 block font-medium">EMERGENCY CONTACT</span>
                <span className="font-semibold text-slate-800 truncate block">
                  {selectedStaff.emergency_contact || "—"}
                </span>
              </div>
            </div>

            {/* Notes */}
            {selectedStaff.notes && (
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                <span className="text-[10px] text-slate-400 block font-medium mb-0.5">NOTES / SPECIALIZATION</span>
                <p className="text-slate-700 leading-relaxed">{selectedStaff.notes}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleDeleteStaff(selectedStaff.id, selectedStaff.full_name)}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 p-1 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              >
                Remove Staff
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingStaff(selectedStaff);
                    setSelectedStaff(null);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStaff(null)}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-black rounded-xl transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          ADD STAFF MODAL
         ========================================================================= */}
      {isAddStaffOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Add Staff Member</h3>
              <button
                type="button"
                onClick={() => setIsAddStaffOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Rajesh Verma or Priya Sharma"
                  value={staffForm.full_name}
                  onChange={(e) => setStaffForm({ ...staffForm, full_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Role / Designation *</label>
                  <select
                    value={staffForm.role}
                    onChange={(e) => {
                      const newRole = e.target.value;
                      setStaffForm({
                        ...staffForm,
                        role: newRole,
                        department: newRole.toLowerCase().includes("doctor") ? "Clinical" : staffForm.department,
                      });
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden font-semibold text-slate-800"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Department *</label>
                  <select
                    value={staffForm.department}
                    onChange={(e) => setStaffForm({ ...staffForm, department: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                  >
                    {DEPARTMENT_OPTIONS.filter((d) => d !== "All Departments").map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 98765 00000"
                    value={staffForm.phone}
                    onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="doctor@clinic.com"
                    value={staffForm.email}
                    onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Employment Type</label>
                  <select
                    value={staffForm.employment_type}
                    onChange={(e) => setStaffForm({ ...staffForm, employment_type: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                  >
                    <option value="full_time">Full Time</option>
                    <option value="part_time">Part Time</option>
                    <option value="contract">Contract</option>
                    <option value="shift">Shift Based</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Monthly Salary (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    placeholder="50000"
                    value={staffForm.base_salary_rupees}
                    onChange={(e) => setStaffForm({ ...staffForm, base_salary_rupees: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Emergency Contact</label>
                <input
                  type="text"
                  placeholder="e.g. Spouse (+91 98765 11111)"
                  value={staffForm.emergency_contact}
                  onChange={(e) => setStaffForm({ ...staffForm, emergency_contact: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Notes / Specialization</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Consultant physician, OPD morning shift, etc."
                  value={staffForm.notes}
                  onChange={(e) => setStaffForm({ ...staffForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddStaffOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-brand-700 hover:bg-brand-800 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Add Staff Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          EDIT STAFF MODAL
         ========================================================================= */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Edit Staff Member</h3>
              <button
                type="button"
                onClick={() => setEditingStaff(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateStaff} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={editingStaff.full_name}
                  onChange={(e) => setEditingStaff({ ...editingStaff, full_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Role / Designation *</label>
                  <select
                    value={editingStaff.role}
                    onChange={(e) => setEditingStaff({ ...editingStaff, role: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden font-semibold text-slate-800"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Department *</label>
                  <select
                    value={editingStaff.department}
                    onChange={(e) => setEditingStaff({ ...editingStaff, department: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                  >
                    {DEPARTMENT_OPTIONS.filter((d) => d !== "All Departments").map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={editingStaff.phone}
                    onChange={(e) => setEditingStaff({ ...editingStaff, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Email Address</label>
                  <input
                    type="email"
                    value={editingStaff.email || ""}
                    onChange={(e) => setEditingStaff({ ...editingStaff, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Status</label>
                  <select
                    value={editingStaff.status}
                    onChange={(e) => setEditingStaff({ ...editingStaff, status: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden capitalize"
                  >
                    <option value="active">Active</option>
                    <option value="on_leave">On Leave</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Monthly Salary (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={Math.round(editingStaff.base_salary_paise / 100)}
                    onChange={(e) =>
                      setEditingStaff({
                        ...editingStaff,
                        base_salary_paise: Math.round(parseFloat(e.target.value || "0") * 100),
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Emergency Contact</label>
                <input
                  type="text"
                  value={editingStaff.emergency_contact || ""}
                  onChange={(e) => setEditingStaff({ ...editingStaff, emergency_contact: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Notes / Specialization</label>
                <textarea
                  rows={2}
                  value={editingStaff.notes || ""}
                  onChange={(e) => setEditingStaff({ ...editingStaff, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-brand-700 hover:bg-brand-800 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
