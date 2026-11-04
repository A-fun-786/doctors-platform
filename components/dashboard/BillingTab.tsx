"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Receipt,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  RotateCw,
  Printer,
  CreditCard,
  Banknote,
  Smartphone,
  AlertCircle,
  FileText,
  Trash2,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Clock,
  ShieldCheck,
  ChevronDown,
  BookOpen,
} from "lucide-react";
import {
  DoctorMeResponse,
  Invoice,
  InvoiceItemCreateInput,
  InvoiceCreateInput,
  PaymentCreateInput,
  BillingStats,
  ServiceCatalogItem,
  getBillingStats,
  getInvoices,
  getInvoice,
  createInvoice,
  issueInvoice,
  cancelInvoice,
  recordInvoicePayment,
  getServiceCatalog,
  createServiceCatalogItem,
  seedDefaultCatalog,
} from "@/lib/api";
import { logger } from "@/lib/logger";
import { DashboardTabId } from "./DashboardShell";

interface BillingTabProps {
  doctor: DoctorMeResponse;
  onNavigateTab?: (tab: DashboardTabId) => void;
}

export default function BillingTab({ doctor, onNavigateTab: _onNavigateTab }: BillingTabProps) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<BillingStats | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [catalog, setCatalog] = useState<ServiceCatalogItem[]>([]);

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modals state
  const [isNewInvoiceOpen, setIsNewInvoiceOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);

  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New Invoice Form State
  const [invPatientName, setInvPatientName] = useState("");
  const [invPatientContact, setInvPatientContact] = useState("");
  const [invPatientEmail, setInvPatientEmail] = useState("");
  const [invDueDate, setInvDueDate] = useState("");
  const [invNotes, setInvNotes] = useState("");
  const [invDiscountRupees, setInvDiscountRupees] = useState<number>(0);
  const [invAutoIssue, setInvAutoIssue] = useState(true);
  const [invItems, setInvItems] = useState<
    Array<{
      source_module: string;
      description: string;
      quantity: number;
      unit_price_rupees: number;
      tax_rate_percent: number;
    }>
  >([
    {
      source_module: "consultation",
      description: "General Consultation",
      quantity: 1,
      unit_price_rupees: 500,
      tax_rate_percent: 0,
    },
  ]);

  // Payment Form State
  const [payAmountRupees, setPayAmountRupees] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<"cash" | "upi" | "card" | "online" | "other">("cash");
  const [payRef, setPayRef] = useState("");
  const [payNotes, setPayNotes] = useState("");

  // New Catalog Item Form State
  const [catName, setCatName] = useState("");
  const [catCategory, setCatCategory] = useState("Consultation");
  const [catPriceRupees, setCatPriceRupees] = useState<number>(0);
  const [catTaxRate, setCatTaxRate] = useState<number>(0);

  // Data loader
  const loadData = useCallback(async () => {
    try {
      setRefreshing(true);
      setErrorMsg(null);
      const [statsRes, invRes, catRes] = await Promise.all([
        getBillingStats().catch(() => null),
        getInvoices({
          status: statusFilter !== "all" ? statusFilter : undefined,
          search: searchQuery || undefined,
        }),
        getServiceCatalog().catch(() => []),
      ]);

      if (statsRes) setStats(statsRes);
      setInvoices(invRes.invoices);
      setCatalog(catRes);
    } catch (err: unknown) {
      logger.error("BillingTab", "Failed to load billing records", {
        error: err instanceof Error ? err.message : String(err),
      });
      setErrorMsg("Failed to load billing records. Please retry.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Create Invoice
  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invPatientName.trim()) {
      setErrorMsg("Patient name is required.");
      return;
    }
    if (invItems.length === 0) {
      setErrorMsg("Please add at least one line item.");
      return;
    }

    try {
      setActionLoading(true);
      setErrorMsg(null);

      const payload: InvoiceCreateInput = {
        patient_name: invPatientName.trim(),
        patient_contact: invPatientContact.trim() || undefined,
        patient_email: invPatientEmail.trim() || undefined,
        due_date: invDueDate || undefined,
        notes: invNotes.trim() || undefined,
        discount_paise: Math.round(invDiscountRupees * 100),
        auto_issue: invAutoIssue,
        items: invItems.map((it) => ({
          source_module: it.source_module,
          description: it.description.trim(),
          quantity: it.quantity,
          unit_price_paise: Math.round(it.unit_price_rupees * 100),
          tax_rate_percent: it.tax_rate_percent,
        })),
      };

      const created = await createInvoice(payload);
      setSuccessMsg(`Invoice #${created.invoice_number} created successfully.`);
      setIsNewInvoiceOpen(false);

      // Reset form
      setInvPatientName("");
      setInvPatientContact("");
      setInvPatientEmail("");
      setInvDueDate("");
      setInvNotes("");
      setInvDiscountRupees(0);
      setInvItems([
        {
          source_module: "consultation",
          description: "General Consultation",
          quantity: 1,
          unit_price_rupees: 500,
          tax_rate_percent: 0,
        },
      ]);

      await loadData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to create invoice.");
    } finally {
      setActionLoading(false);
    }
  };

  // Open Payment Modal
  const openPaymentModal = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setPayAmountRupees(invoice.balance_due_paise / 100);
    setPayMethod("cash");
    setPayRef("");
    setPayNotes("");
    setIsPaymentModalOpen(true);
  };

  // Handle Record Payment
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    const amountPaise = Math.round(payAmountRupees * 100);
    if (amountPaise <= 0) {
      setErrorMsg("Payment amount must be greater than zero.");
      return;
    }
    if (amountPaise > selectedInvoice.balance_due_paise) {
      setErrorMsg("Payment amount cannot exceed the balance due.");
      return;
    }

    try {
      setActionLoading(true);
      setErrorMsg(null);

      const payload: PaymentCreateInput = {
        amount_paise: amountPaise,
        method: payMethod,
        reference_number: payRef.trim() || undefined,
        notes: payNotes.trim() || undefined,
        idempotency_key: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      };

      await recordInvoicePayment(selectedInvoice.id, payload);
      setSuccessMsg(`Payment of ₹${payAmountRupees.toLocaleString("en-IN")} recorded.`);
      setIsPaymentModalOpen(false);
      await loadData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to record payment.");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Issue Draft Invoice
  const handleIssueInvoice = async (invoiceId: string) => {
    try {
      setActionLoading(true);
      await issueInvoice(invoiceId);
      setSuccessMsg("Invoice issued and locked.");
      await loadData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to issue invoice.");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Cancel Invoice
  const handleCancelInvoice = async (invoiceId: string) => {
    if (!window.confirm("Are you sure you want to cancel this invoice? This cannot be undone.")) {
      return;
    }
    try {
      setActionLoading(true);
      await cancelInvoice(invoiceId, "Cancelled by clinic administration");
      setSuccessMsg("Invoice cancelled.");
      await loadData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to cancel invoice.");
    } finally {
      setActionLoading(false);
    }
  };

  // Add Item to New Invoice
  const handleAddItemRow = (preset?: ServiceCatalogItem) => {
    if (preset) {
      setInvItems((prev) => [
        ...prev,
        {
          source_module: preset.category.toLowerCase().includes("lab")
            ? "lab"
            : preset.category.toLowerCase().includes("pharm")
            ? "pharmacy"
            : "consultation",
          description: preset.name,
          quantity: 1,
          unit_price_rupees: preset.unit_price_paise / 100,
          tax_rate_percent: preset.tax_rate_percent,
        },
      ]);
    } else {
      setInvItems((prev) => [
        ...prev,
        {
          source_module: "consultation",
          description: "",
          quantity: 1,
          unit_price_rupees: 0,
          tax_rate_percent: 0,
        },
      ]);
    }
  };

  const handleRemoveItemRow = (idx: number) => {
    setInvItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // Calculated Live Totals for Invoice Form
  const liveTotals = useMemo(() => {
    let subtotal = 0;
    let taxTotal = 0;
    for (const it of invItems) {
      const base = it.quantity * it.unit_price_rupees;
      const tax = base * (it.tax_rate_percent / 100);
      subtotal += base;
      taxTotal += tax;
    }
    const discount = Math.min(subtotal, Math.max(0, invDiscountRupees));
    const grandTotal = Math.max(0, subtotal - discount + taxTotal);
    return { subtotal, taxTotal, discount, grandTotal };
  }, [invItems, invDiscountRupees]);

  // Seed default catalog
  const handleSeedCatalog = async () => {
    try {
      setActionLoading(true);
      await seedDefaultCatalog();
      const freshCat = await getServiceCatalog();
      setCatalog(freshCat);
      setSuccessMsg("Standard clinic service rates seeded successfully.");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to seed catalog.");
    } finally {
      setActionLoading(false);
    }
  };

  // Create Catalog Item
  const handleCreateCatalogItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim() || catPriceRupees <= 0) {
      setErrorMsg("Name and positive price are required.");
      return;
    }
    try {
      setActionLoading(true);
      await createServiceCatalogItem({
        name: catName.trim(),
        category: catCategory,
        unit_price_paise: Math.round(catPriceRupees * 100),
        tax_rate_percent: catTaxRate,
      });
      const freshCat = await getServiceCatalog();
      setCatalog(freshCat);
      setCatName("");
      setCatPriceRupees(0);
      setSuccessMsg("New service rate added.");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to add service item.");
    } finally {
      setActionLoading(false);
    }
  };

  // Format Paise to INR string
  const formatINR = (paise: number) => {
    const rupees = (paise || 0) / 100;
    return `₹${rupees.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Open Receipt Print View
  const openReceiptModal = async (inv: Invoice) => {
    try {
      const full = await getInvoice(inv.id);
      setSelectedInvoice(full);
      setIsReceiptModalOpen(true);
    } catch {
      setSelectedInvoice(inv);
      setIsReceiptModalOpen(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-rose-600 hover:text-rose-900 font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="text-emerald-600 hover:text-emerald-900 font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-5 sm:p-7 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-medium border border-white/10 mb-2">
            <Receipt className="w-3.5 h-3.5 text-indigo-400" />
            <span>Ledger &amp; Financial Management</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight">
            Patient Billing &amp; Invoices
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Central ledger recording consultations, pharmacy orders, lab fees, and instant receipt printing.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsCatalogModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl border border-white/20 transition-all"
          >
            <BookOpen className="w-3.5 h-3.5 text-indigo-300" />
            <span>Fee Catalog</span>
          </button>

          <button
            type="button"
            onClick={() => setIsNewInvoiceOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Invoice</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Invoiced
            </span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900">
            {formatINR(stats?.total_billed_paise || 0)}
          </div>
          <div className="text-[11px] text-slate-500">
            {stats?.total_invoices_count || 0} total invoices
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
              Collected Today
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-700">
            {formatINR(stats?.total_collected_today_paise || 0)}
          </div>
          <div className="text-[11px] text-slate-500">Settled via Cash / UPI / Card</div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">
              Outstanding Balance
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-700">
            {formatINR(stats?.total_outstanding_paise || 0)}
          </div>
          <div className="text-[11px] text-slate-500">
            {stats?.unpaid_invoices_count || 0} invoices with pending balance
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Settlement Rate
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900">
            {stats && stats.total_invoices_count > 0
              ? `${Math.round((stats.paid_invoices_count / stats.total_invoices_count) * 100)}%`
              : "100%"}
          </div>
          <div className="text-[11px] text-slate-500">
            {stats?.paid_invoices_count || 0} fully settled
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search invoice #, patient, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 w-full sm:w-auto">
            {["all", "draft", "issued", "partially_paid", "paid", "cancelled"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  statusFilter === st
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {st === "all" ? "All" : st.replace("_", " ").toUpperCase()}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={refreshing}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors shrink-0"
            title="Refresh"
          >
            <RotateCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Invoices List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        {loading ? (
          <div className="py-16 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
            <RotateCw className="w-4 h-4 animate-spin text-indigo-600" />
            <span>Loading billing ledger...</span>
          </div>
        ) : invoices.length === 0 ? (
          <div className="py-16 text-center text-slate-500 space-y-3">
            <Receipt className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">No invoices found</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Create an invoice for a walk-in patient or check your filter criteria.
            </p>
            <button
              type="button"
              onClick={() => setIsNewInvoiceOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create First Invoice</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-600 uppercase font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Paid</th>
                  <th className="py-3 px-4">Balance</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => {
                  const isPaid = inv.status === "paid";
                  const isDraft = inv.status === "draft";
                  const isCancelled = inv.status === "cancelled";
                  const canPay = (inv.status === "issued" || inv.status === "partially_paid") && inv.balance_due_paise > 0;

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {inv.invoice_number}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {inv.issue_date || new Date(inv.created_at).toISOString().split("T")[0]}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{inv.patient_name}</div>
                        {inv.patient_contact && (
                          <div className="text-[11px] text-slate-500">{inv.patient_contact}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <div className="truncate max-w-[180px]">
                          {inv.items.map((it) => it.description).join(", ")}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {inv.items.length} {inv.items.length === 1 ? "line item" : "line items"}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {formatINR(inv.total_amount_paise)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-emerald-600">
                        {formatINR(inv.paid_amount_paise)}
                      </td>
                      <td className="py-3 px-4 font-bold">
                        {inv.balance_due_paise > 0 ? (
                          <span className="text-amber-600">{formatINR(inv.balance_due_paise)}</span>
                        ) : (
                          <span className="text-slate-400">₹0.00</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isPaid
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : inv.status === "partially_paid"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : inv.status === "issued"
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : isDraft
                              ? "bg-slate-100 text-slate-600 border border-slate-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {inv.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {canPay && (
                            <button
                              type="button"
                              onClick={() => openPaymentModal(inv)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold rounded-lg shadow-2xs transition-colors flex items-center gap-1"
                              title="Record payment"
                            >
                              <Banknote className="w-3.5 h-3.5" />
                              <span>Pay</span>
                            </button>
                          )}

                          {isDraft && (
                            <button
                              type="button"
                              onClick={() => handleIssueInvoice(inv.id)}
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold rounded-lg shadow-2xs transition-colors"
                              title="Issue and lock invoice"
                            >
                              Issue
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => openReceiptModal(inv)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                            title="Print / View Receipt"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {(isDraft || (inv.status === "issued" && inv.paid_amount_paise === 0)) && (
                            <button
                              type="button"
                              onClick={() => handleCancelInvoice(inv.id)}
                              className="p-1.5 bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                              title="Cancel invoice"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =========================================================================
          MODAL: NEW INVOICE
          ========================================================================= */}
      {isNewInvoiceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 my-8 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Create Patient Invoice</h3>
                <p className="text-xs text-slate-500">
                  Bill consultation, pharmacy prescriptions, or lab diagnostics.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewInvoiceOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="space-y-4">
              {/* Patient Information */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Patient Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={invPatientName}
                    onChange={(e) => setInvPatientName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Phone Contact
                  </label>
                  <input
                    type="text"
                    value={invPatientContact}
                    onChange={(e) => setInvPatientContact(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={invDueDate}
                    onChange={(e) => setInvDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              {/* Quick Catalog Adder */}
              {catalog.length > 0 && (
                <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-1.5">
                  <div className="text-[11px] font-bold text-indigo-900 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Quick Add from Service Catalog</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {catalog.slice(0, 6).map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => handleAddItemRow(cat)}
                        className="px-2.5 py-1 bg-white hover:bg-indigo-100 border border-indigo-200 text-indigo-800 text-[11px] font-medium rounded-lg transition-colors"
                      >
                        + {cat.name} ({formatINR(cat.unit_price_paise)})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Line Items Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 uppercase">
                    Line Items
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAddItemRow()}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Custom Item</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {invItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs"
                    >
                      <div className="col-span-3">
                        <select
                          value={item.source_module}
                          onChange={(e) => {
                            const val = e.target.value;
                            setInvItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, source_module: val } : it))
                            );
                          }}
                          className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                        >
                          <option value="consultation">Consultation</option>
                          <option value="pharmacy">Pharmacy</option>
                          <option value="lab">Lab Test</option>
                          <option value="checkup">Checkup</option>
                          <option value="other">Other</option>
                        </select>
                      </div>

                      <div className="col-span-4">
                        <input
                          type="text"
                          required
                          placeholder="Description"
                          value={item.description}
                          onChange={(e) => {
                            const val = e.target.value;
                            setInvItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, description: val } : it))
                            );
                          }}
                          className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                        />
                      </div>

                      <div className="col-span-1">
                        <input
                          type="number"
                          min="1"
                          title="Quantity"
                          value={item.quantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 1;
                            setInvItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, quantity: val } : it))
                            );
                          }}
                          className="w-full px-1.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-center"
                        />
                      </div>

                      <div className="col-span-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Price (₹)"
                          value={item.unit_price_rupees}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setInvItems((prev) =>
                              prev.map((it, i) =>
                                i === idx ? { ...it, unit_price_rupees: val } : it
                              )
                            );
                          }}
                          className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                        />
                      </div>

                      <div className="col-span-1 text-right font-bold text-slate-800">
                        ₹{(item.quantity * item.unit_price_rupees).toFixed(0)}
                      </div>

                      <div className="col-span-1 text-right">
                        {invItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItemRow(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals and Discounts */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span className="font-semibold">₹{liveTotals.subtotal.toFixed(2)}</span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-600">Special Discount (₹):</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={invDiscountRupees}
                    onChange={(e) => setInvDiscountRupees(parseFloat(e.target.value) || 0)}
                    className="w-28 px-2 py-1 bg-white border border-slate-200 rounded text-right font-semibold"
                  />
                </div>

                <div className="border-t border-slate-200 pt-2 flex items-center justify-between text-sm font-black text-slate-900">
                  <span>Total Amount Due:</span>
                  <span className="text-indigo-600 font-mono">
                    ₹{liveTotals.grandTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Status checkbox */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoIssue"
                  checked={invAutoIssue}
                  onChange={(e) => setInvAutoIssue(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="autoIssue" className="text-xs text-slate-700">
                  Issue and finalize immediately (uncheck to save as draft)
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewInvoiceOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm"
                >
                  {actionLoading ? "Generating Invoice..." : "Create Invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: RECORD PAYMENT
          ========================================================================= */}
      {isPaymentModalOpen && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Record Payment</h3>
                <p className="text-xs text-slate-500 font-mono">
                  {selectedInvoice.invoice_number} • {selectedInvoice.patient_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ×
              </button>
            </div>

            <div className="bg-indigo-50 p-3.5 rounded-xl border border-indigo-100 flex items-center justify-between text-xs">
              <div>
                <div className="text-indigo-900 font-semibold">Total Invoiced:</div>
                <div className="text-indigo-700">{formatINR(selectedInvoice.total_amount_paise)}</div>
              </div>
              <div className="text-right">
                <div className="text-indigo-900 font-semibold">Balance Due:</div>
                <div className="text-indigo-700 font-bold text-sm">
                  {formatINR(selectedInvoice.balance_due_paise)}
                </div>
              </div>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Payment Amount (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="1"
                  max={selectedInvoice.balance_due_paise / 100}
                  value={payAmountRupees}
                  onChange={(e) => setPayAmountRupees(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold font-mono text-slate-900 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Payment Method *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "cash", label: "Cash", icon: Banknote },
                    { id: "upi", label: "UPI / QR", icon: Smartphone },
                    { id: "card", label: "Card / POS", icon: CreditCard },
                  ].map((m) => {
                    const Icon = m.icon;
                    const isSelected = payMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPayMethod(m.id as any)}
                        className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                          isSelected
                            ? "border-indigo-600 bg-indigo-50 text-indigo-700 font-bold"
                            : "border-slate-200 hover:bg-slate-50 text-slate-600"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-[11px]">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Reference # / UTR / Auth Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. UPI-93821038102 or Cash Receipt"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm"
                >
                  {actionLoading ? "Recording..." : "Confirm Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: SERVICE CATALOG MANAGEMENT
          ========================================================================= */}
      {isCatalogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Clinic Service &amp; Fee Catalog</h3>
                <p className="text-xs text-slate-500">
                  Pre-configured consultation, lab, and treatment fees for fast billing.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCatalogModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ×
              </button>
            </div>

            {/* Quick Seed Button */}
            {catalog.length === 0 && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-center">
                <p className="text-xs text-amber-900 font-semibold">
                  Your fee catalog is currently empty.
                </p>
                <button
                  type="button"
                  onClick={handleSeedCatalog}
                  disabled={actionLoading}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-xs"
                >
                  Seed Standard Medical Fees (₹500 / ₹300 / ₹150)
                </button>
              </div>
            )}

            {/* Add Custom Item Form */}
            <form onSubmit={handleCreateCatalogItem} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <span className="text-[11px] font-bold text-slate-700 uppercase">
                Add New Standard Rate
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <input
                  type="text"
                  required
                  placeholder="Service Name (e.g. ECG)"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="sm:col-span-2 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                />
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="Price (₹)"
                  value={catPriceRupees || ""}
                  onChange={(e) => setCatPriceRupees(parseFloat(e.target.value) || 0)}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                />
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg"
                >
                  Add Rate
                </button>
              </div>
            </form>

            {/* Catalog List */}
            <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
              {catalog.map((c) => (
                <div key={c.id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50">
                  <div>
                    <div className="font-bold text-slate-900">{c.name}</div>
                    <div className="text-[10px] text-slate-500 uppercase">{c.category}</div>
                  </div>
                  <div className="font-bold text-slate-900 font-mono">
                    {formatINR(c.unit_price_paise)}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCatalogModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: PRINTABLE RECEIPT / INVOICE VIEW (Supports window.print())
          ========================================================================= */}
      {isReceiptModalOpen && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 my-8 space-y-6 print:m-0 print:p-0 print:shadow-none print:border-none">
            {/* Top Toolbar (Hidden on print) */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 print:hidden">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Tax Invoice &amp; Official Receipt</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Receipt</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsReceiptModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-lg px-2"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Printable Receipt Paper */}
            <div className="space-y-6 text-slate-800 p-2">
              {/* Header */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-lg font-black text-slate-900 tracking-tight">
                    {doctor.full_name}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    {doctor.speciality || "General Physician & Clinic"}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">{doctor.email}</p>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm font-bold text-slate-900">
                    {selectedInvoice.invoice_number}
                  </div>
                  <div className="text-xs text-slate-500">
                    Date: {selectedInvoice.issue_date || new Date(selectedInvoice.created_at).toLocaleDateString()}
                  </div>
                  <div className="mt-1">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        selectedInvoice.status === "paid"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {selectedInvoice.status.replace("_", " ")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Billed To */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between items-center text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Billed To (Patient)
                  </span>
                  <span className="font-bold text-slate-900 text-sm">
                    {selectedInvoice.patient_name}
                  </span>
                </div>
                {selectedInvoice.patient_contact && (
                  <div className="text-right text-slate-600">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Contact
                    </span>
                    <span>{selectedInvoice.patient_contact}</span>
                  </div>
                )}
              </div>

              {/* Items Table */}
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                    <th className="py-2">Description</th>
                    <th className="py-2 text-center">Qty</th>
                    <th className="py-2 text-right">Unit Price</th>
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedInvoice.items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-2 font-medium text-slate-800">{item.description}</td>
                      <td className="py-2 text-center text-slate-600">{item.quantity}</td>
                      <td className="py-2 text-right text-slate-600 font-mono">
                        {formatINR(item.unit_price_paise)}
                      </td>
                      <td className="py-2 text-right font-bold text-slate-900 font-mono">
                        {formatINR(item.line_total_paise)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Ledger Summary */}
              <div className="border-t border-slate-200 pt-3 space-y-1.5 text-xs text-right">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span className="font-mono">{formatINR(selectedInvoice.subtotal_paise)}</span>
                </div>
                {selectedInvoice.discount_paise > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Discount:</span>
                    <span className="font-mono">-{formatINR(selectedInvoice.discount_paise)}</span>
                  </div>
                )}
                {selectedInvoice.tax_paise > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Tax (GST):</span>
                    <span className="font-mono">+{formatINR(selectedInvoice.tax_paise)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black text-slate-900 border-t border-slate-200 pt-2">
                  <span>Grand Total:</span>
                  <span className="font-mono text-indigo-700">
                    {formatINR(selectedInvoice.total_amount_paise)}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-emerald-700 font-bold">
                  <span>Total Paid:</span>
                  <span className="font-mono">{formatINR(selectedInvoice.paid_amount_paise)}</span>
                </div>
                <div className="flex justify-between text-xs text-amber-700 font-bold">
                  <span>Balance Due:</span>
                  <span className="font-mono">{formatINR(selectedInvoice.balance_due_paise)}</span>
                </div>
              </div>

              {/* Payment Transactions Record */}
              {selectedInvoice.payments && selectedInvoice.payments.length > 0 && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Settlement Transactions
                  </span>
                  {selectedInvoice.payments.map((p) => (
                    <div key={p.id} className="flex justify-between items-center text-[11px] text-slate-600">
                      <span>
                        • {p.method.toUpperCase()} ({new Date(p.created_at).toLocaleDateString()})
                        {p.reference_number ? ` - Ref: ${p.reference_number}` : ""}
                      </span>
                      <span className="font-mono font-bold text-emerald-700">
                        {formatINR(p.amount_paise)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Footer Note */}
              <div className="text-center text-[10px] text-slate-400 pt-4 border-t border-slate-100">
                This is a computer-generated tax invoice &amp; receipt issued by {doctor.full_name}.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

