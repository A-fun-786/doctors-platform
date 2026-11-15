"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Pill,
  Package,
  AlertTriangle,
  Clock,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  RotateCw,
  Edit2,
  Trash2,
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  IndianRupee,
} from "lucide-react";
import {
  DoctorMeResponse,
  MedicineItem,
  MedicineItemCreateInput,
  PharmacyStats,
  getPharmacyStats,
  getMedicineInventory,
  createMedicineItem,
  updateMedicineItem,
  deleteMedicineItem,
} from "@/lib/api";
import { DashboardTabId } from "./DashboardShell";

interface PharmacyTabProps {
  doctor: DoctorMeResponse;
  onNavigateTab?: (tab: DashboardTabId) => void;
}

const CATEGORIES = [
  "All Categories",
  "Antibiotics",
  "Analgesics & Pain",
  "Cardiovascular",
  "Respiratory",
  "Diabetes & Endocrine",
  "Antihistamines & Allergy",
  "Gastrointestinal",
  "Vitamins & Supplements",
  "Dermatology",
  "General",
];

const DOSAGE_FORMS = [
  "Tablet",
  "Capsule",
  "Syrup",
  "Suspension",
  "Injection",
  "Ointment",
  "Cream",
  "Drops",
  "Inhaler",
];

export default function PharmacyTab({ doctor: _doctor }: PharmacyTabProps) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<PharmacyStats | null>(null);

  // Inventory state
  const [medicines, setMedicines] = useState<MedicineItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [statusFilter, setStatusFilter] = useState<"all" | "in_stock" | "low_stock" | "out_of_stock" | "expiring_soon">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MedicineItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Add / Edit form state
  const [formData, setFormData] = useState<MedicineItemCreateInput>({
    name: "",
    generic_name: "",
    category: "General",
    dosage_form: "Tablet",
    strength: "",
    sku: "",
    batch_number: "",
    stock_quantity: 50,
    min_stock_alert: 10,
    purchase_price: 0.0,
    unit_price: 0,
    expiry_date: "",
    manufacturer: "",
    description: "",
  });

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true);
    setErrorMsg(null);
    try {
      const [statsRes, medsRes] = await Promise.all([
        getPharmacyStats().catch(() => null),
        getMedicineInventory({ search: searchQuery }).catch(() => ({ items: [], total: 0 })),
      ]);

      if (statsRes) setStats(statsRes);
      setMedicines(medsRes.items || []);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to load dispensary data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showNotification = (msg: string, isError = false) => {
    if (isError) {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(null), 5000);
    } else {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setFormData({
      name: "",
      generic_name: "",
      category: "General",
      dosage_form: "Tablet",
      strength: "",
      sku: "",
      batch_number: "",
      stock_quantity: 50,
      min_stock_alert: 10,
      purchase_price: 0.0,
      unit_price: 0,
      expiry_date: "",
      manufacturer: "",
      description: "",
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (item: MedicineItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      generic_name: item.generic_name || "",
      category: item.category,
      dosage_form: item.dosage_form,
      strength: item.strength || "",
      sku: item.sku || "",
      batch_number: item.batch_number || "",
      stock_quantity: item.stock_quantity,
      min_stock_alert: item.min_stock_alert,
      purchase_price: item.purchase_price ?? 0.0,
      unit_price: item.unit_price,
      expiry_date: item.expiry_date || "",
      manufacturer: item.manufacturer || "",
      description: item.description || "",
    });
    setIsAddModalOpen(true);
  };

  const handleSaveMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showNotification("Medicine name is required", true);
      return;
    }
    if (formData.unit_price === undefined || formData.unit_price === null || formData.unit_price <= 0) {
      showNotification("Selling price is required and must be greater than 0", true);
      return;
    }
    if (!formData.expiry_date) {
      showNotification("Expiry date is required", true);
      return;
    }
    setActionLoading(true);
    try {
      if (editingItem) {
        await updateMedicineItem(editingItem.id, {
          ...formData,
          name: formData.name.trim(),
          generic_name: formData.generic_name?.trim() || undefined,
          sku: formData.sku?.trim() || undefined,
          expiry_date: formData.expiry_date,
        });
        showNotification(`Updated "${formData.name.trim()}"`);
      } else {
        await createMedicineItem({
          ...formData,
          name: formData.name.trim(),
          generic_name: formData.generic_name?.trim() || undefined,
          sku: formData.sku?.trim() || undefined,
          expiry_date: formData.expiry_date,
        });
        showNotification(`Added "${formData.name.trim()}" to dispensary`);
      }
      setIsAddModalOpen(false);
      await loadData(true);
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : "Failed to save medicine", true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteMedicine = async (item: MedicineItem) => {
    if (!confirm(`Are you sure you want to remove "${item.name}" from inventory?`)) return;
    setActionLoading(true);
    try {
      await deleteMedicineItem(item.id);
      showNotification(`Removed "${item.name}"`);
      await loadData(true);
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : "Failed to delete medicine", true);
    } finally {
      setActionLoading(false);
    }
  };

  // Filter medicines locally
  const filteredMedicines = useMemo(() => {
    return medicines.filter((m) => {
      // Category filter
      if (selectedCategory !== "All Categories" && m.category !== selectedCategory) {
        return false;
      }
      // Status filter
      if (statusFilter === "in_stock" && m.status !== "in_stock") return false;
      if (statusFilter === "low_stock" && m.status !== "low_stock") return false;
      if (statusFilter === "out_of_stock" && m.status !== "out_of_stock") return false;
      if (statusFilter === "expiring_soon" && !m.is_expiring_soon && !m.is_expired) return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = m.name.toLowerCase().includes(q);
        const matchGen = m.generic_name?.toLowerCase().includes(q);
        const matchSku = m.sku?.toLowerCase().includes(q);
        const matchCat = m.category.toLowerCase().includes(q);
        if (!matchName && !matchGen && !matchSku && !matchCat) return false;
      }
      return true;
    });
  }, [medicines, selectedCategory, statusFilter, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, statusFilter, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredMedicines.length / pageSize));
  const paginatedMedicines = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredMedicines.slice(start, start + pageSize);
  }, [filteredMedicines, currentPage, pageSize]);

  return (
    <div className="space-y-5">
      {/* Notifications */}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3.5 flex items-center justify-between text-xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium">{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-800 font-bold ml-4">
            Dismiss
          </button>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3.5 flex items-center justify-between text-xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-800 font-bold ml-4">
            Dismiss
          </button>
        </div>
      )}

      {/* Classic Page Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold">
              <Pill className="w-4.5 h-4.5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                Dispensary &amp; Medicines
              </h1>
              <p className="text-xs text-slate-500">
                Track clinic inventory levels, set reorder thresholds, and monitor batch expiry.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition-colors disabled:opacity-50"
            title="Refresh inventory"
          >
            <RotateCw className={`w-3.5 h-3.5 text-slate-500 ${refreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Medicine</span>
          </button>
        </div>
      </div>

      {/* Classic 4-KPI Overview Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Catalog Items */}
        <div
          onClick={() => setStatusFilter("all")}
          className={`bg-white rounded-xl border p-4 shadow-xs flex items-center gap-3.5 cursor-pointer transition-all hover:border-slate-300 ${
            statusFilter === "all" ? "border-slate-900 ring-1 ring-slate-900/10" : "border-slate-200"
          }`}
        >
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Catalog Items</p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold text-slate-900 tabular-nums">
                {stats?.total_medicines ?? medicines.length}
              </span>
              <span className="text-[11px] text-slate-400">
                ({stats?.total_units_in_stock ?? 0} units)
              </span>
            </div>
          </div>
        </div>

        {/* Healthy In-Stock */}
        <div
          onClick={() => setStatusFilter("in_stock")}
          className={`bg-white rounded-xl border p-4 shadow-xs flex items-center gap-3.5 cursor-pointer transition-all hover:border-emerald-300 ${
            statusFilter === "in_stock" ? "border-emerald-600 ring-1 ring-emerald-600/10" : "border-slate-200"
          }`}
        >
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">In Stock</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xl font-bold text-slate-900 tabular-nums">
                {stats?.in_stock_count ?? medicines.filter((m) => m.status === "in_stock").length}
              </span>
              <span className="px-1.5 py-0.2 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
                Healthy
              </span>
            </div>
          </div>
        </div>

        {/* Low Stock Warning */}
        <div
          onClick={() => setStatusFilter("low_stock")}
          className={`bg-white rounded-xl border p-4 shadow-xs flex items-center gap-3.5 cursor-pointer transition-all hover:border-amber-300 ${
            statusFilter === "low_stock"
              ? "border-amber-600 ring-1 ring-amber-600/10"
              : (stats?.low_stock_count || 0) > 0
              ? "border-amber-200 bg-amber-50/15"
              : "border-slate-200"
          }`}
        >
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Low Stock</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xl font-bold text-slate-900 tabular-nums">
                {stats?.low_stock_count ?? 0}
              </span>
              {(stats?.low_stock_count || 0) > 0 && (
                <span className="px-1.5 py-0.2 text-[10px] font-semibold bg-amber-100 text-amber-800 rounded">
                  Reorder
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Expiring Soon */}
        <div
          onClick={() => setStatusFilter("expiring_soon")}
          className={`bg-white rounded-xl border p-4 shadow-xs flex items-center gap-3.5 cursor-pointer transition-all hover:border-rose-300 ${
            statusFilter === "expiring_soon"
              ? "border-rose-600 ring-1 ring-rose-600/10"
              : (stats?.expiring_soon_count || 0) > 0
              ? "border-rose-200 bg-rose-50/15"
              : "border-slate-200"
          }`}
        >
          <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Expiring Soon</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xl font-bold text-slate-900 tabular-nums">
                {stats?.expiring_soon_count ?? 0}
              </span>
              {(stats?.expiring_soon_count || 0) > 0 && (
                <span className="px-1.5 py-0.2 text-[10px] font-semibold bg-rose-100 text-rose-800 rounded">
                  &le; 30d
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Classic Unified Control Bar: Search + Category + Status Pills */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs space-y-2.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by brand name, generic formula, SKU..."
              className="w-full pl-9 pr-8 py-1.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                &times;
              </button>
            )}
          </div>

          {/* Category Dropdown */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <div className="relative w-full sm:w-52">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full appearance-none pl-3 pr-7 py-1.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 cursor-pointer transition-colors"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Clean Status Filter Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: "all", label: "All Items" },
              { id: "in_stock", label: "In Stock" },
              { id: "low_stock", label: "Low Stock" },
              { id: "out_of_stock", label: "Out of Stock" },
              { id: "expiring_soon", label: "Expiring Soon" },
            ].map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => setStatusFilter(btn.id as typeof statusFilter)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  statusFilter === btn.id
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          <span className="text-[11px] text-slate-400 font-medium">
            Showing {filteredMedicines.length} of {medicines.length} medicines
          </span>
        </div>
      </div>

      {/* Main Clinical Table */}
      {filteredMedicines.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Pill className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">No medicines found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-0.5">
              {searchQuery || selectedCategory !== "All Categories" || statusFilter !== "all"
                ? "Try clearing filters to see all clinical inventory."
                : "Your dispensary stock is empty. Click below to add your clinic's medicines."}
            </p>
          </div>
          <div className="flex justify-center gap-2 pt-1">
            {medicines.length === 0 ? (
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                + Add Medicine
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("All Categories");
                  setStatusFilter("all");
                }}
                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-md"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700 tracking-wide">
                  <th className="py-3 px-4 w-[28%] min-w-[220px]">Medicine &amp; Details</th>
                  <th className="py-3 px-4 w-[16%] min-w-[130px]">Category</th>
                  <th className="py-3 px-4 w-[16%] min-w-[130px]">Stock Level</th>
                  <th className="py-3 px-4 w-[12%] min-w-[110px]">Purchased Price</th>
                  <th className="py-3 px-4 w-[12%] min-w-[110px]">Sale Price</th>
                  <th className="py-3 px-4 w-[12%] min-w-[110px]">Expiry Date</th>
                  <th className="py-3 px-4 w-[4%] min-w-[70px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {paginatedMedicines.map((item) => {
                  const isLowStock = item.status === "low_stock";
                  const isOutOfStock = item.status === "out_of_stock";

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                      {/* Name, Generic, Dosage, SKU */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {item.name}
                        </div>
                        <div className="text-[11px] text-slate-600 flex items-center gap-1.5 mt-0.5">
                          {item.generic_name && <span>{item.generic_name}</span>}
                          {item.dosage_form && (
                            <span className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-medium text-[10px]">
                              {item.dosage_form}
                            </span>
                          )}
                          {item.strength && <span className="text-slate-500 font-medium">({item.strength})</span>}
                        </div>
                        {item.sku && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            SKU: {item.sku}
                          </div>
                        )}
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-100 text-slate-800 border border-slate-200/60">
                          {item.category}
                        </span>
                      </td>

                      {/* Stock Quantity & Visual Dot */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              isOutOfStock
                                ? "bg-rose-500"
                                : isLowStock
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            }`}
                          />
                          <span
                            className={`font-semibold tabular-nums text-xs ${
                              isOutOfStock
                                ? "text-rose-600 font-bold"
                                : isLowStock
                                ? "text-amber-600 font-bold"
                                : "text-slate-900"
                            }`}
                          >
                            {item.stock_quantity} units
                          </span>
                          {isOutOfStock ? (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-rose-50 text-rose-700 border border-rose-200">
                              Out
                            </span>
                          ) : isLowStock ? (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-amber-50 text-amber-700 border border-amber-200">
                              Low
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* Purchased Price */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-0.5 font-medium text-slate-800 tabular-nums">
                          <IndianRupee className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{(item.purchase_price ?? 0).toFixed(2)}</span>
                        </span>
                      </td>

                      {/* Sale Price */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-0.5 font-medium text-slate-800 tabular-nums">
                          <IndianRupee className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{item.unit_price.toFixed(2)}</span>
                        </span>
                      </td>

                      {/* Expiry Date */}
                      <td className="py-3.5 px-4">
                        {item.expiry_date ? (
                          <div className="space-y-0.5">
                            <span
                              className={`tabular-nums ${
                                item.is_expired
                                  ? "text-rose-600 font-semibold"
                                  : item.is_expiring_soon
                                  ? "text-amber-600 font-semibold"
                                  : "text-slate-700"
                              }`}
                            >
                              {item.expiry_date}
                            </span>
                            {item.is_expired ? (
                              <div className="text-[10px] font-semibold text-rose-600">Expired</div>
                            ) : item.is_expiring_soon ? (
                              <div className="text-[10px] font-semibold text-amber-600">Expiring Soon</div>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Not set</span>
                        )}
                      </td>

                      {/* Clean Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(item)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                            title="Edit Medicine"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMedicine(item)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                            title="Delete Medicine"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {filteredMedicines.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-1.5 text-slate-600">
                <span>Showing</span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  {(currentPage - 1) * pageSize + 1}&ndash;{Math.min(currentPage * pageSize, filteredMedicines.length)}
                </span>
                <span>of</span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  {filteredMedicines.length}
                </span>
                <span>medicines</span>
              </div>

              <div className="flex items-center gap-3">
                {/* Page Size Selector */}
                <div className="flex items-center gap-1.5 text-slate-500">
                  <span>Per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="px-2 py-1 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                {/* Page Navigation */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="px-2 font-medium text-slate-700 tabular-nums">
                    Page {currentPage} of {totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="p-1 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          MODAL: ADD / EDIT MEDICINE (Classic 2-Column Medical Form)
          ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-slate-900 text-white flex items-center justify-center">
                  <Pill className="w-3.5 h-3.5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {editingItem ? "Edit Clinical Medicine" : "Add Medicine to Catalog"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveMedicine} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Group 1: Medication Details */}
              <div className="space-y-3">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  1. Clinical Formulation
                </p>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Medicine / Brand Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Amoxicillin 500mg, Augmentin 625mg..."
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Generic / Chemical Formula
                    </label>
                    <input
                      type="text"
                      value={formData.generic_name || ""}
                      onChange={(e) => setFormData({ ...formData, generic_name: e.target.value })}
                      placeholder="e.g. Amoxicillin Clavulanate"
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Therapeutic Category
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                    >
                      {CATEGORIES.filter((c) => c !== "All Categories").map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Dosage Form
                    </label>
                    <select
                      value={formData.dosage_form}
                      onChange={(e) => setFormData({ ...formData, dosage_form: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                    >
                      {DOSAGE_FORMS.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Strength / Unit
                    </label>
                    <input
                      type="text"
                      value={formData.strength || ""}
                      onChange={(e) => setFormData({ ...formData, strength: e.target.value })}
                      placeholder="e.g. 500 mg, 100 ml"
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      SKU / Barcode
                    </label>
                    <input
                      type="text"
                      value={formData.sku || ""}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      placeholder="e.g. MED-AMX500"
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Group 2: Stock, Pricing & Expiry */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  2. Inventory &amp; Expiry
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Initial Stock (Units) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={formData.stock_quantity ?? 0}
                      onChange={(e) =>
                        setFormData({ ...formData, stock_quantity: parseInt(e.target.value, 10) || 0 })
                      }
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Low Stock Threshold
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={formData.min_stock_alert ?? 10}
                      onChange={(e) =>
                        setFormData({ ...formData, min_stock_alert: parseInt(e.target.value, 10) || 0 })
                      }
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Purchased Price
                    </label>
                    <div className="relative">
                      <IndianRupee className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={formData.purchase_price ?? 0}
                        onChange={(e) =>
                          setFormData({ ...formData, purchase_price: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Sale Price <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <IndianRupee className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        placeholder="0.00"
                        value={formData.unit_price > 0 ? formData.unit_price : ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            unit_price: e.target.value === "" ? 0 : parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Expiry Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.expiry_date || ""}
                      onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Manufacturer / Supplier
                    </label>
                    <input
                      type="text"
                      value={formData.manufacturer || ""}
                      onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                      placeholder="e.g. Pfizer, Cipla..."
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors disabled:opacity-50"
                >
                  {actionLoading ? "Saving..." : editingItem ? "Update Medicine" : "Save Medicine"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
