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
  Sparkles,
  AlertCircle,
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
  adjustMedicineStock,
  seedSampleMedicines,
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

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MedicineItem | null>(null);
  const [adjustingItem, setAdjustingItem] = useState<MedicineItem | null>(null);
  const [adjustDelta, setAdjustDelta] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState("");
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
    unit_price: 10.0,
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
      setErrorMsg(err instanceof Error ? err.message : "Failed to load pharmacy data");
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

  const handleSeedSamples = async () => {
    setActionLoading(true);
    try {
      await seedSampleMedicines();
      showNotification("Successfully seeded sample clinic medicines!");
      await loadData(true);
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : "Failed to seed samples", true);
    } finally {
      setActionLoading(false);
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
      unit_price: 10.0,
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
    setActionLoading(true);
    try {
      if (editingItem) {
        await updateMedicineItem(editingItem.id, {
          ...formData,
          expiry_date: formData.expiry_date ? formData.expiry_date : null,
        });
        showNotification(`Updated "${formData.name}" successfully`);
      } else {
        await createMedicineItem({
          ...formData,
          expiry_date: formData.expiry_date ? formData.expiry_date : null,
        });
        showNotification(`Added "${formData.name}" to inventory`);
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

  const handleOpenAdjustStock = (item: MedicineItem) => {
    setAdjustingItem(item);
    setAdjustDelta(0);
    setAdjustReason("");
  };

  const handleApplyStockAdjustment = async () => {
    if (!adjustingItem || adjustDelta === 0) return;
    setActionLoading(true);
    try {
      await adjustMedicineStock(adjustingItem.id, adjustDelta, adjustReason);
      showNotification(`Updated stock for ${adjustingItem.name} (${adjustDelta > 0 ? "+" : ""}${adjustDelta})`);
      setAdjustingItem(null);
      await loadData(true);
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : "Failed to adjust stock", true);
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

  return (
    <div className="space-y-6">
      {/* Top Banner & Notifications */}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <p className="text-sm font-medium">{errorMsg}</p>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-500 hover:text-red-800 text-sm font-bold">
            Dismiss
          </button>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="text-sm font-medium">{successMsg}</p>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-800 text-sm font-bold">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold">
              <Pill className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Dispensary &amp; Medicine Inventory
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 max-w-2xl leading-relaxed">
            Monitor clinic dispensary stock levels, set automated low-stock warnings, track expiration dates, and record inventory adjustments.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200/70 rounded-xl transition-colors disabled:opacity-50"
            title="Refresh inventory"
          >
            <RotateCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          {medicines.length === 0 && !loading && (
            <button
              type="button"
              onClick={handleSeedSamples}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/60 rounded-xl transition-colors disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Seed Sample Medicines</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-xs hover:shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Medicine</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Catalog Items */}
        <div
          onClick={() => setStatusFilter("all")}
          className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-xs flex items-center gap-4 cursor-pointer transition-all hover:border-blue-400 ${
            statusFilter === "all" ? "border-blue-300 ring-2 ring-blue-500/10" : "border-slate-200/80"
          }`}
        >
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Catalog Items</p>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
              {stats?.total_medicines ?? medicines.length}
            </h3>
            <p className="text-[11px] text-slate-400 truncate">
              {stats?.total_units_in_stock ?? 0} total units in stock
            </p>
          </div>
        </div>

        {/* Healthy / In-Stock */}
        <div
          onClick={() => setStatusFilter("in_stock")}
          className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-xs flex items-center gap-4 cursor-pointer transition-all hover:border-emerald-400 ${
            statusFilter === "in_stock" ? "border-emerald-300 ring-2 ring-emerald-500/10" : "border-slate-200/80"
          }`}
        >
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">In Stock</p>
            <div className="flex items-center gap-2 mt-0.5">
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
                {stats?.in_stock_count ?? medicines.filter((m) => m.status === "in_stock").length}
              </h3>
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-md">
                Healthy
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate">Adequate inventory</p>
          </div>
        </div>

        {/* Low Stock Warning */}
        <div
          onClick={() => setStatusFilter("low_stock")}
          className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-xs flex items-center gap-4 cursor-pointer transition-all hover:border-amber-400 ${
            statusFilter === "low_stock"
              ? "border-amber-300 ring-2 ring-amber-500/10"
              : (stats?.low_stock_count || 0) > 0
              ? "border-amber-200 bg-amber-50/20"
              : "border-slate-200/80"
          }`}
        >
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Low Stock</p>
            <div className="flex items-center gap-2 mt-0.5">
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
                {stats?.low_stock_count ?? 0}
              </h3>
              {(stats?.low_stock_count || 0) > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded-md">
                  Action
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 truncate">Below reorder alert</p>
          </div>
        </div>

        {/* Expiring Soon */}
        <div
          onClick={() => setStatusFilter("expiring_soon")}
          className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-xs flex items-center gap-4 cursor-pointer transition-all hover:border-rose-400 ${
            statusFilter === "expiring_soon"
              ? "border-rose-300 ring-2 ring-rose-500/10"
              : (stats?.expiring_soon_count || 0) > 0
              ? "border-rose-200 bg-rose-50/20"
              : "border-slate-200/80"
          }`}
        >
          <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Expiring Soon</p>
            <div className="flex items-center gap-2 mt-0.5">
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
                {stats?.expiring_soon_count ?? 0}
              </h3>
              {(stats?.expiring_soon_count || 0) > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-rose-100 text-rose-800 rounded-md">
                  &le; 30d
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 truncate">Next 30 days check</p>
          </div>
        </div>
      </div>

      {/* Controls: Search, Category, Status Pills */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search medicines by brand name, generic formula, SKU or category..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                Clear
              </button>
            )}
          </div>

          {/* Category Dropdown */}
          <div className="relative sm:w-60">
            <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full pl-8 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Filter Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">
            Status:
          </span>
          {[
            { id: "all", label: "All Items" },
            { id: "in_stock", label: "In Stock" },
            { id: "low_stock", label: "Low Stock Alert" },
            { id: "out_of_stock", label: "Out of Stock" },
            { id: "expiring_soon", label: "Expiring Soon" },
          ].map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => setStatusFilter(btn.id as typeof statusFilter)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === btn.id
                  ? "bg-brand-50 text-brand-700 border border-brand-200 shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Medicines Grid / Table */}
      {filteredMedicines.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Pill className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">No medicines found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery || selectedCategory !== "All Categories" || statusFilter !== "all"
                ? "Try adjusting your search filters to find what you're looking for."
                : "Your clinic inventory is currently empty. Add your first medicine or seed standard clinic stock."}
            </p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            {medicines.length === 0 ? (
              <>
                <button
                  type="button"
                  onClick={handleSeedSamples}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-xl border border-indigo-200 transition-colors"
                >
                  Seed Sample Stock
                </button>
                <button
                  type="button"
                  onClick={handleOpenAddModal}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs"
                >
                  + Add Medicine
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("All Categories");
                  setStatusFilter("all");
                }}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Medicine &amp; Details</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Stock Level</th>
                  <th className="py-3 px-4">Unit Price</th>
                  <th className="py-3 px-4">Expiry Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredMedicines.map((item) => {
                  const isLowStock = item.status === "low_stock";
                  const isOutOfStock = item.status === "out_of_stock";

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors group">
                      {/* Name, Generic, SKU */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 group-hover:text-brand-600 transition-colors">
                          {item.name}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                          {item.generic_name && <span>{item.generic_name}</span>}
                          {item.dosage_form && (
                            <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded text-[10px]">
                              {item.dosage_form}
                            </span>
                          )}
                          {item.strength && <span className="text-slate-400">({item.strength})</span>}
                        </div>
                        {item.sku && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            SKU: {item.sku}
                          </div>
                        )}
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-100 text-slate-700">
                          {item.category}
                        </span>
                      </td>

                      {/* Stock Quantity & Badge */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-bold ${
                              isOutOfStock
                                ? "text-red-600"
                                : isLowStock
                                ? "text-amber-600"
                                : "text-slate-900"
                            }`}
                          >
                            {item.stock_quantity} units
                          </span>
                          {isOutOfStock ? (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-red-100 text-red-700">
                              Out of Stock
                            </span>
                          ) : isLowStock ? (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-100 text-amber-800">
                              Low Stock
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-100 text-emerald-800">
                              Healthy
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Alert threshold: &le; {item.min_stock_alert}
                        </p>
                      </td>

                      {/* Unit Price */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">
                          ${item.unit_price.toFixed(2)}
                        </div>
                      </td>

                      {/* Expiry Date */}
                      <td className="py-3.5 px-4">
                        {item.expiry_date ? (
                          <div className="space-y-0.5">
                            <span
                              className={`font-medium ${
                                item.is_expired
                                ? "text-red-600 font-bold"
                                : item.is_expiring_soon
                                ? "text-amber-600 font-bold"
                                : "text-slate-600"
                              }`}
                            >
                              {item.expiry_date}
                            </span>
                            {item.is_expired ? (
                              <div className="text-[10px] font-bold text-red-600">Expired</div>
                            ) : item.is_expiring_soon ? (
                              <div className="text-[10px] font-bold text-amber-600">Expiring Soon</div>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Not set</span>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenAdjustStock(item)}
                            className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-brand-50 hover:text-brand-700 rounded-lg transition-colors border border-slate-200/80"
                            title="Adjust Stock Quantity"
                          >
                            &plus;/&minus; Stock
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(item)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Edit Medicine"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMedicine(item)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
        </div>
      )}

      {/* =========================================================================
          MODAL: ADD / EDIT MEDICINE
          ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                  <Pill className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">
                  {editingItem ? "Edit Medicine" : "Add Medicine to Catalog"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveMedicine} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Medicine Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Medicine / Brand Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Amoxicillin 500mg, Augmentin 625mg..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>

              {/* Generic Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Generic / Chemical Formula
                </label>
                <input
                  type="text"
                  value={formData.generic_name || ""}
                  onChange={(e) => setFormData({ ...formData, generic_name: e.target.value })}
                  placeholder="e.g. Amoxicillin Clavulanate"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>

              {/* Category & Dosage Form */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Therapeutic Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  >
                    {CATEGORIES.filter((c) => c !== "All Categories").map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Dosage Form
                  </label>
                  <select
                    value={formData.dosage_form}
                    onChange={(e) => setFormData({ ...formData, dosage_form: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  >
                    {DOSAGE_FORMS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Strength & SKU */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Strength / Unit
                  </label>
                  <input
                    type="text"
                    value={formData.strength || ""}
                    onChange={(e) => setFormData({ ...formData, strength: e.target.value })}
                    placeholder="e.g. 500 mg, 100 ml"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    SKU / Barcode
                  </label>
                  <input
                    type="text"
                    value={formData.sku || ""}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    placeholder="e.g. MED-AMX500"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                </div>
              </div>

              {/* Stock Quantity & Min Alert */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Current Stock Quantity <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={formData.stock_quantity ?? 0}
                    onChange={(e) =>
                      setFormData({ ...formData, stock_quantity: parseInt(e.target.value, 10) || 0 })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Low Stock Alert Threshold
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.min_stock_alert ?? 10}
                    onChange={(e) =>
                      setFormData({ ...formData, min_stock_alert: parseInt(e.target.value, 10) || 0 })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                </div>
              </div>

              {/* Unit Price & Expiry Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Unit Price ($) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    required
                    value={formData.unit_price ?? 0}
                    onChange={(e) =>
                      setFormData({ ...formData, unit_price: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={formData.expiry_date || ""}
                    onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                </div>
              </div>

              {/* Manufacturer */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Manufacturer / Supplier
                </label>
                <input
                  type="text"
                  value={formData.manufacturer || ""}
                  onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                  placeholder="e.g. Pfizer, Novartis, Cipla..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-xs transition-colors disabled:opacity-50"
                >
                  {actionLoading ? "Saving..." : editingItem ? "Update Medicine" : "Add Medicine"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: QUICK STOCK ADJUSTMENT (+ / -)
          ========================================================================= */}
      {adjustingItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-sm w-full shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Adjust Stock Level</h3>
                <p className="text-xs text-slate-500 font-medium truncate">{adjustingItem.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setAdjustingItem(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl text-xs">
                <span className="text-slate-500">Current Stock:</span>
                <span className="font-bold text-slate-900 text-sm">{adjustingItem.stock_quantity} units</span>
              </div>

              {/* Quick shortcut buttons */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Quick Delta:
                </span>
                <div className="grid grid-cols-4 gap-1.5 text-xs font-bold">
                  {[+10, +50, +100, -5, -10, -20, -50].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setAdjustDelta((prev) => prev + val)}
                      className={`py-1.5 rounded-lg border text-center transition-colors ${
                        val > 0
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                          : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                      }`}
                    >
                      {val > 0 ? `+${val}` : val}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setAdjustDelta(0)}
                    className="py-1.5 rounded-lg border bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 text-center"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Exact delta input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Stock Change (+ addition, &minus; deduction)
                </label>
                <input
                  type="number"
                  value={adjustDelta}
                  onChange={(e) => setAdjustDelta(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              {/* Result Preview */}
              <div className="bg-brand-50/60 border border-brand-100 p-3 rounded-xl flex items-center justify-between text-xs">
                <span className="text-brand-800 font-medium">New Projected Stock:</span>
                <span
                  className={`font-bold text-sm ${
                    adjustingItem.stock_quantity + adjustDelta < 0
                      ? "text-red-600"
                      : "text-brand-900"
                  }`}
                >
                  {adjustingItem.stock_quantity + adjustDelta} units
                </span>
              </div>
              {adjustingItem.stock_quantity + adjustDelta < 0 && (
                <p className="text-[11px] text-red-600 font-medium">
                  Cannot reduce stock below 0.
                </p>
              )}

              {/* Optional reason */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reason / Batch Note (Optional)
                </label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Supplier restocking, Dispensed to patient, Expired disposal"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setAdjustingItem(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyStockAdjustment}
                disabled={actionLoading || adjustDelta === 0 || adjustingItem.stock_quantity + adjustDelta < 0}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-colors disabled:opacity-50"
              >
                {actionLoading ? "Updating..." : "Save Stock"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
