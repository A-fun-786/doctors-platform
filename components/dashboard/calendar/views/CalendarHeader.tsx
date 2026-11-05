"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  UserCheck,
  Plus,
  Search,
  Check,
  X,
  Stethoscope,
} from "lucide-react";
import { CalendarViewMode } from "../types";
import { Practitioner } from "@/lib/api";

interface CalendarHeaderProps {
  weekRangeTitle: string;
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday?: () => void;
  onBookAppointment?: () => void;
  practitioners?: Practitioner[];
  selectedPractitionerId?: string | null;
  onPractitionerChange?: (staffId: string | null) => void;
  selectedDate?: string;
  onSelectDate?: (dateStr: string) => void;
}

function formatDateToYYYYMMDD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseYYYYMMDD(dateStr: string): Date {
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  return new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, parseInt(dayStr, 10));
}

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

export default function CalendarHeader({
  weekRangeTitle,
  viewMode,
  onViewModeChange,
  onPrevWeek,
  onNextWeek,
  onToday,
  onBookAppointment,
  practitioners = [],
  selectedPractitionerId = null,
  onPractitionerChange,
  selectedDate = "",
  onSelectDate,
}: CalendarHeaderProps) {
  // Searchable Doctor Selector Dropdown state
  const [isDoctorDropdownOpen, setIsDoctorDropdownOpen] = useState(false);
  const [doctorSearch, setDoctorSearch] = useState("");
  const doctorDropdownRef = useRef<HTMLDivElement>(null);

  // Date Picker Popover state
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);

  const todayStr = useMemo(() => formatDateToYYYYMMDD(new Date()), []);

  // Calendar month state for the popover picker
  const [pickerMonth, setPickerMonth] = useState<Date>(() => {
    if (selectedDate) {
      try {
        return parseYYYYMMDD(selectedDate);
      } catch {
        return new Date();
      }
    }
    return new Date();
  });

  // Keep pickerMonth aligned when selectedDate changes externally
  useEffect(() => {
    if (selectedDate) {
      try {
        const d = parseYYYYMMDD(selectedDate);
        setPickerMonth(new Date(d.getFullYear(), d.getMonth(), 1));
      } catch {
        // ignore
      }
    }
  }, [selectedDate]);

  // Close popovers on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        doctorDropdownRef.current &&
        !doctorDropdownRef.current.contains(target)
      ) {
        setIsDoctorDropdownOpen(false);
      }
      if (
        datePickerRef.current &&
        !datePickerRef.current.contains(target)
      ) {
        setIsDatePickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsDoctorDropdownOpen(false);
        setIsDatePickerOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Label for currently selected practitioner
  const currentSelectionLabel = useMemo(() => {
    if (!selectedPractitionerId || selectedPractitionerId === "ALL") {
      return practitioners.length > 0
        ? `All Doctors (${practitioners.length})`
        : "All Doctors";
    }
    if (selectedPractitionerId === "PRIMARY") {
      const primaryDoc = practitioners.find((p) => p.is_primary);
      return primaryDoc ? `${primaryDoc.name} (Primary)` : "Primary Doctor";
    }
    const staffDoc = practitioners.find((p) => p.id === selectedPractitionerId);
    return staffDoc ? staffDoc.name : "Selected Doctor";
  }, [selectedPractitionerId, practitioners]);

  // Filtered practitioners list based on search query
  const filteredPractitioners = useMemo(() => {
    if (!doctorSearch.trim()) return practitioners;
    const q = doctorSearch.toLowerCase();
    return practitioners.filter((p) => {
      const name = (p.name || "").toLowerCase();
      const spec = (p.speciality || "").toLowerCase();
      const role = (p.role || "").toLowerCase();
      const dept = (p.department || "").toLowerCase();
      return name.includes(q) || spec.includes(q) || role.includes(q) || dept.includes(q);
    });
  }, [practitioners, doctorSearch]);

  // Formatted date title for display in the header
  const displayTitle = useMemo(() => {
    if (viewMode === "week") {
      return weekRangeTitle;
    }
    if (viewMode === "month") {
      try {
        const d = parseYYYYMMDD(selectedDate);
        return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      } catch {
        return weekRangeTitle;
      }
    }
    // "agenda" or "day"
    if (!selectedDate) return weekRangeTitle;
    try {
      const d = parseYYYYMMDD(selectedDate);
      const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
      const month = d.toLocaleDateString("en-US", { month: "short" });
      const day = d.getDate();
      const year = d.getFullYear();

      if (selectedDate === todayStr) {
        return `Today, ${weekday}, ${month} ${day}`;
      }
      return `${weekday}, ${month} ${day}, ${year}`;
    } catch {
      return selectedDate;
    }
  }, [viewMode, selectedDate, weekRangeTitle, todayStr]);

  // Generate 35-42 days matrix for the interactive date picker popover
  const pickerDays = useMemo(() => {
    const year = pickerMonth.getFullYear();
    const month = pickerMonth.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: {
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
    }[] = [];

    // Prev month padding
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 1, d);
      const dateStr = formatDateToYYYYMMDD(prevDate);
      days.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDate,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const curDate = new Date(year, month, d);
      const dateStr = formatDateToYYYYMMDD(curDate);
      days.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDate,
      });
    }

    // Next month padding to fill grid
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(year, month + 1, d);
      const dateStr = formatDateToYYYYMMDD(nextDate);
      days.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDate,
      });
    }

    return days;
  }, [pickerMonth, selectedDate, todayStr]);

  const handlePickDate = (dateStr: string) => {
    onSelectDate?.(dateStr);
    setIsDatePickerOpen(false);
  };

  const handlePickerPrevMonth = () => {
    setPickerMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handlePickerNextMonth = () => {
    setPickerMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-2.5 sm:p-3 select-none">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3">
        {/* Left Section: Doctor Selector & Date Navigation (Fixed single line, no row break) */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-nowrap shrink-0">
          {/* Searchable Doctor Selector Dropdown */}
          <div className="relative" ref={doctorDropdownRef}>
            {practitioners.length > 0 && onPractitionerChange && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setIsDoctorDropdownOpen((prev) => !prev);
                    setIsDatePickerOpen(false);
                    setDoctorSearch("");
                  }}
                  aria-expanded={isDoctorDropdownOpen}
                  aria-haspopup="listbox"
                  className={`flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border rounded-xl px-3 py-1.5 shadow-2xs transition-all cursor-pointer ${
                    isDoctorDropdownOpen
                      ? "border-brand-500 ring-2 ring-brand-500/20 text-brand-900 bg-white"
                      : "border-slate-200 text-slate-800"
                  }`}
                >
                  <Stethoscope className="w-4 h-4 text-brand-600 shrink-0" />
                  <span className="text-xs font-bold max-w-[150px] sm:max-w-[200px] truncate">
                    {currentSelectionLabel}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
                      isDoctorDropdownOpen ? "rotate-180 text-brand-600" : ""
                    }`}
                  />
                </button>

                {/* Searchable Dropdown Popover */}
                {isDoctorDropdownOpen && (
                  <div className="absolute left-0 top-full mt-1.5 w-72 sm:w-80 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100">
                    {/* Search Input Box */}
                    <div className="p-2.5 border-b border-slate-100 bg-slate-50/70">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={doctorSearch}
                          onChange={(e) => setDoctorSearch(e.target.value)}
                          placeholder="Search doctor or speciality..."
                          autoFocus
                          className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                        />
                        {doctorSearch && (
                          <button
                            type="button"
                            onClick={() => setDoctorSearch("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Doctors List */}
                    <div className="max-h-60 overflow-y-auto py-1 divide-y divide-slate-50 custom-scrollbar">
                      {/* All Doctors option */}
                      {(!doctorSearch.trim() || "all doctors".includes(doctorSearch.toLowerCase())) && (
                        <button
                          type="button"
                          onClick={() => {
                            onPractitionerChange(null);
                            setIsDoctorDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                            !selectedPractitionerId || selectedPractitionerId === "ALL"
                              ? "bg-brand-50 text-brand-700 font-bold"
                              : "text-slate-700 hover:bg-slate-50 font-medium"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
                              <UserCheck className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <div className="text-xs">All Doctors</div>
                              <div className="text-[10px] text-slate-400 font-normal">
                                {practitioners.length} clinic practitioners
                              </div>
                            </div>
                          </div>
                          {(!selectedPractitionerId || selectedPractitionerId === "ALL") && (
                            <Check className="w-4 h-4 text-brand-600 shrink-0" />
                          )}
                        </button>
                      )}

                      {/* Filtered Individual Doctors */}
                      {filteredPractitioners.map((p) => {
                        const val = p.id ?? "PRIMARY";
                        const isSelected = selectedPractitionerId === val;

                        return (
                          <button
                            key={p.id ?? "PRIMARY"}
                            type="button"
                            onClick={() => {
                              onPractitionerChange(val);
                              setIsDoctorDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                              isSelected
                                ? "bg-brand-50 text-brand-700 font-bold"
                                : "text-slate-700 hover:bg-slate-50 font-medium"
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="text-xs font-semibold text-slate-900 truncate">
                                {p.name}
                              </div>
                              <div className="text-[10px] text-slate-500 font-normal truncate flex items-center gap-1.5 mt-0.5">
                                <span className="font-medium text-slate-600">
                                  {p.is_primary ? "Practice Owner" : "Staff Doctor"}
                                </span>
                                {p.speciality && (
                                  <>
                                    <span>•</span>
                                    <span className="truncate">{p.speciality}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            {isSelected && (
                              <Check className="w-4 h-4 text-brand-600 shrink-0" />
                            )}
                          </button>
                        );
                      })}

                      {/* Empty Search Result */}
                      {filteredPractitioners.length === 0 && doctorSearch.trim() && (
                        <div className="py-6 px-4 text-center text-xs text-slate-400 space-y-1">
                          <p className="font-semibold text-slate-600">No doctors found</p>
                          <p className="text-[11px]">No doctors match &quot;{doctorSearch}&quot;</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Vertical Divider */}
          <div className="h-6 w-px bg-slate-200 hidden sm:block" />

          {/* Date Display & Navigation Capsule (Click opens Interactive Calendar) */}
          <div className="relative" ref={datePickerRef}>
            <div className="inline-flex items-center gap-1 sm:gap-1.5 bg-slate-50 border border-slate-200 rounded-xl p-1 shadow-2xs">
              {onToday && (
                <button
                  type="button"
                  onClick={onToday}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-white hover:bg-slate-100 text-slate-700 transition-colors shadow-2xs cursor-pointer border border-slate-200/80 mr-0.5"
                >
                  Today
                </button>
              )}
              <button
                type="button"
                onClick={onPrevWeek}
                className="p-1 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                title="Previous"
                aria-label="Previous"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Clickable Date Button that opens Calendar Picker */}
              <button
                type="button"
                onClick={() => {
                  setIsDatePickerOpen((prev) => !prev);
                  setIsDoctorDropdownOpen(false);
                }}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all cursor-pointer ${
                  isDatePickerOpen
                    ? "bg-white shadow-2xs border border-brand-300 text-brand-700 font-extrabold"
                    : "hover:bg-white hover:shadow-2xs border border-transparent text-slate-900 font-bold"
                }`}
                title="Click to choose a date from calendar"
                aria-expanded={isDatePickerOpen}
                aria-haspopup="dialog"
              >
                <CalendarIcon className="w-3.5 h-3.5 text-brand-600 shrink-0" aria-hidden="true" />
                <h2 className="text-xs sm:text-sm tracking-tight text-center truncate">
                  {displayTitle}
                </h2>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                    isDatePickerOpen ? "rotate-180 text-brand-600" : ""
                  }`}
                />
              </button>

              <button
                type="button"
                onClick={onNextWeek}
                className="p-1 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                title="Next"
                aria-label="Next"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Interactive Calendar Popover */}
            {isDatePickerOpen && (
              <div className="absolute left-0 top-full mt-2 w-72 sm:w-80 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 p-3.5 animate-in fade-in-50 zoom-in-95 duration-100 select-none">
                {/* Month Navigation Header */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="text-xs font-bold text-slate-800">
                    {pickerMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </h3>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handlePickerPrevMonth}
                      className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                      title="Previous month"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handlePickerNextMonth}
                      className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                      title="Next month"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Quick Date Jump Pills */}
                <div className="flex items-center gap-1.5 mb-2.5 pb-2.5 border-b border-slate-100 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      onToday?.();
                      setIsDatePickerOpen(false);
                    }}
                    className="flex-1 py-1 rounded-lg bg-slate-50 hover:bg-brand-50 hover:text-brand-700 text-slate-700 font-semibold border border-slate-200 transition-colors cursor-pointer text-center"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const tm = new Date();
                      tm.setDate(tm.getDate() + 1);
                      handlePickDate(formatDateToYYYYMMDD(tm));
                    }}
                    className="flex-1 py-1 rounded-lg bg-slate-50 hover:bg-brand-50 hover:text-brand-700 text-slate-700 font-semibold border border-slate-200 transition-colors cursor-pointer text-center"
                  >
                    Tomorrow
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const nextW = new Date();
                      nextW.setDate(nextW.getDate() + 7);
                      handlePickDate(formatDateToYYYYMMDD(nextW));
                    }}
                    className="flex-1 py-1 rounded-lg bg-slate-50 hover:bg-brand-50 hover:text-brand-700 text-slate-700 font-semibold border border-slate-200 transition-colors cursor-pointer text-center"
                  >
                    +7 Days
                  </button>
                </div>

                {/* Day of Week Labels (M T W T F S S) */}
                <div className="grid grid-cols-7 text-center mb-1">
                  {DAY_LABELS.map((lbl, idx) => (
                    <span key={`lbl-${idx}`} className="text-[10px] font-bold text-slate-400 py-0.5">
                      {lbl}
                    </span>
                  ))}
                </div>

                {/* Month Days Matrix */}
                <div className="grid grid-cols-7 gap-1 text-center">
                  {pickerDays.map((item, idx) => {
                    let cellStyle = "text-slate-700 hover:bg-slate-100 font-medium";
                    if (item.isSelected) {
                      cellStyle = "bg-brand-600 text-white font-bold shadow-xs";
                    } else if (item.isToday) {
                      cellStyle = "border border-brand-500 text-brand-600 font-bold bg-brand-50/50";
                    } else if (!item.isCurrentMonth) {
                      cellStyle = "text-slate-300 hover:bg-slate-50 hover:text-slate-500 font-normal";
                    }

                    return (
                      <button
                        key={`${item.dateStr}-${idx}`}
                        type="button"
                        onClick={() => handlePickDate(item.dateStr)}
                        className={`h-7 w-7 mx-auto rounded-lg text-xs flex items-center justify-center transition-all cursor-pointer ${cellStyle}`}
                      >
                        {item.dayNum}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Section: View Switcher & Primary Action (Fixed single line, no row break) */}
        <div className="flex items-center justify-between md:justify-end gap-2 sm:gap-3 shrink-0 flex-nowrap">
          {/* Agenda / Day / Week / Month Switcher */}
          <div className="inline-flex items-center p-0.5 bg-slate-100 border border-slate-200 rounded-xl shadow-2xs" role="group" aria-label="Calendar view switcher">
            <button
              type="button"
              onClick={() => onViewModeChange("agenda")}
              aria-pressed={viewMode === "agenda"}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all text-center cursor-pointer ${
                viewMode === "agenda"
                  ? "bg-white text-brand-700 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
            >
              Agenda
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("day")}
              aria-pressed={viewMode === "day"}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all text-center cursor-pointer ${
                viewMode === "day"
                  ? "bg-white text-brand-700 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
            >
              Day
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("week")}
              aria-pressed={viewMode === "week"}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all text-center cursor-pointer ${
                viewMode === "week"
                  ? "bg-white text-brand-700 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("month")}
              aria-pressed={viewMode === "month"}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all text-center cursor-pointer ${
                viewMode === "month"
                  ? "bg-white text-brand-700 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
            >
              Month
            </button>
          </div>

          {/* Primary Action: Book Appointment */}
          {onBookAppointment && (
            <button
              type="button"
              onClick={onBookAppointment}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Book Appointment</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
