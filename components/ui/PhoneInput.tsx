"use client";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PhoneInput — Reusable Country Dial Code + Local Number Picker
 *
 * Design: Zero external dependencies, modular, accessible.
 * Features:
 *  - Searchable country dropdown (name, dial code, ISO code)
 *  - Standard WCAG 2.1 AA combobox with aria-activedescendant
 *  - React useId() for collision-free ARIA attributes
 *  - Event bubbling isolated (stopPropagation on search Enter)
 *  - Clean listbox options without nested interactive elements
 *  - Live international format preview
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useId,
  KeyboardEvent,
} from "react";
import { Check, ChevronDown, Phone, X } from "lucide-react";
import {
  COUNTRY_DIAL_CODES,
  CountryDialCode,
  stripLeadingZero,
} from "@/lib/dialCodes";

// ─────────────────────────────────────────────────────────────────────────────

interface CountryFlagProps {
  country: CountryDialCode;
  width?: number;
  height?: number;
}

export function CountryFlag({
  country,
  width = 24,
  height = 18,
}: CountryFlagProps) {
  const [loadFailed, setLoadFailed] = useState(false);
  const code = country?.code?.toLowerCase();

  // Reset loadFailed state when country changes
  useEffect(() => {
    setLoadFailed(false);
  }, [code]);

  if (loadFailed || !code) {
    return (
      <span className="text-base sm:text-lg leading-none shrink-0" aria-hidden="true">
        {country?.flag || "🌐"}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={code}
      src={`https://flagcdn.com/w40/${code}.png`}
      srcSet={`https://flagcdn.com/w80/${code}.png 2x`}
      width={width}
      height={height}
      alt=""
      onError={() => setLoadFailed(true)}
      className="shrink-0 rounded-[2px] object-cover shadow-xs border border-slate-200/80"
      aria-hidden="true"
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export interface PhoneInputProps {
  /** Currently selected country */
  country: CountryDialCode;
  /** Local number without country dial code */
  localNumber: string;
  onCountryChange: (c: CountryDialCode) => void;
  onLocalNumberChange: (v: string) => void;
  /** If true, show inline "Will be saved as: +92 300…" preview */
  showPreview?: boolean;
  disabled?: boolean;
  /** Field error message — displayed below input */
  error?: string | null;
  /** Custom placeholder for local number input */
  placeholder?: string;
  /** ID for accessibility labeling */
  id?: string;
}

// ─────────────────────────────────────────────────────────────────────────────

export function PhoneInput({
  country,
  localNumber,
  onCountryChange,
  onLocalNumberChange,
  showPreview = true,
  disabled = false,
  error,
  placeholder,
  id: customId,
}: PhoneInputProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const baseReactId = useId();
  const idPrefix = customId || `phone-${baseReactId.replace(/:/g, "")}`;
  const listboxId = `${idPrefix}-listbox`;
  const errorId = `${idPrefix}-error`;
  const inputId = `${idPrefix}-input`;

  const wrapperRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const activeCountry = country || COUNTRY_DIAL_CODES[0];
  const cleanedLocal = stripLeadingZero(localNumber);
  const combinedPhone = `${activeCountry.dial || "+92"} ${cleanedLocal}`.trim();

  // ── Filtered country list ──────────────────────────────────────────────────
  const searchLower = search.trim().toLowerCase();
  const filtered = COUNTRY_DIAL_CODES.filter(
    (c) =>
      c.name.toLowerCase().includes(searchLower) ||
      c.dial.includes(searchLower) ||
      c.code.toLowerCase().includes(searchLower)
  );

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setSearch("");
    setFocusedIndex(-1);
  }, []);

  // ── Close on outside click ────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open, closeDropdown]);

  // ── Focus search field when dropdown opens ────────────────────────────────
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => searchRef.current?.focus());
      setFocusedIndex(-1);
    }
  }, [open]);

  // ── Scroll focused item into view ─────────────────────────────────────────
  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[focusedIndex] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [focusedIndex]);

  const selectCountry = useCallback(
    (c: CountryDialCode) => {
      onCountryChange(c);
      closeDropdown();
      requestAnimationFrame(() => triggerRef.current?.focus());
    },
    [onCountryChange, closeDropdown]
  );

  // ── Keyboard navigation in combobox dropdown ──────────────────────────────
  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        closeDropdown();
        triggerRef.current?.focus();
        break;
      case "ArrowDown":
        e.preventDefault();
        e.stopPropagation();
        setFocusedIndex((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        e.stopPropagation();
        setFocusedIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        // Prevent form submission / parent wizard advance
        e.stopPropagation();
        if (focusedIndex >= 0 && filtered[focusedIndex]) {
          selectCountry(filtered[focusedIndex]);
        } else if (filtered.length === 1) {
          selectCountry(filtered[0]);
        }
        break;
    }
  };

  const activeOptionId =
    focusedIndex >= 0 && filtered[focusedIndex]
      ? `${idPrefix}-opt-${filtered[focusedIndex].code}`
      : undefined;

  return (
    <div className="space-y-1.5">
      {/* ── Input Row ───────────────────────────────────────────────────── */}
      <div
        ref={wrapperRef}
        className={[
          "flex rounded-xl border transition-all duration-150 shadow-2xs",
          "bg-hospital-surface focus-within:bg-white",
          error
            ? "border-red-400 focus-within:ring-4 focus-within:ring-red-400/10"
            : "border-hospital-borderDark focus-within:border-brand-600 focus-within:ring-4 focus-within:ring-brand-500/10",
        ].join(" ")}
      >
        {/* Country Trigger */}
        <div className="relative shrink-0">
          <button
            ref={triggerRef}
            type="button"
            disabled={disabled}
            aria-label={`Country code: ${activeCountry.name} (${activeCountry.dial}). Click to change.`}
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-controls={listboxId}
            onClick={() => setOpen((v) => !v)}
            className={[
              "flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-3 min-h-[52px]",
              "min-w-[84px] sm:min-w-[150px] sm:max-w-[210px]",
              "border-r border-hospital-borderDark rounded-l-xl",
              "text-sm font-semibold text-hospital-textMain",
              "hover:bg-slate-50 transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-inset",
              "disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer",
            ].join(" ")}
          >
            {/* Flag */}
            <CountryFlag country={activeCountry} width={22} height={16} />

            {/* Country name + dial code: stacked on sm+, dial-only on mobile */}
            <span className="hidden sm:flex flex-col items-start min-w-0 flex-1">
              <span className="text-xs font-bold text-hospital-textMain leading-tight truncate w-full">
                {activeCountry.name}
              </span>
              <span className="text-[11px] font-mono font-semibold text-hospital-textSubtle leading-tight">
                {activeCountry.dial}
              </span>
            </span>

            {/* Mobile compact dial code badge */}
            <span className="sm:hidden font-mono text-xs font-bold text-hospital-textMain leading-tight">
              {activeCountry.dial}
            </span>

            <ChevronDown
              aria-hidden="true"
              className={`w-3.5 h-3.5 text-hospital-textSubtle shrink-0 transition-transform duration-150 ${
                open ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* ── Dropdown Combobox Popup ─────────────────────────────────── */}
          {open && (
            <div
              className={[
                "absolute left-0 top-full mt-1.5 z-50",
                "w-[calc(100vw-3rem)] max-w-xs sm:w-72 bg-white border border-hospital-border rounded-xl",
                "shadow-xl shadow-slate-900/10 overflow-hidden",
              ].join(" ")}
            >
              {/* Search input (Combobox) */}
              <div className="p-2 border-b border-hospital-border relative">
                <input
                  ref={searchRef}
                  type="text"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={open}
                  aria-controls={listboxId}
                  aria-activedescendant={activeOptionId}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setFocusedIndex(-1);
                  }}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search country or +code…"
                  aria-label="Search countries"
                  className={[
                    "w-full pl-3 pr-7 py-2 text-xs rounded-lg",
                    "border border-hospital-borderDark bg-hospital-surface",
                    "focus:outline-none focus:border-brand-600 focus:bg-white",
                    "font-medium text-hospital-textMain",
                    "placeholder:text-hospital-textSubtle/60",
                  ].join(" ")}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      searchRef.current?.focus();
                    }}
                    aria-label="Clear search"
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-hospital-textSubtle hover:text-hospital-textMain p-0.5"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>

              {/* ARIA Listbox: No nested buttons in options */}
              <ul
                id={listboxId}
                ref={listRef}
                role="listbox"
                aria-label="Country dial codes"
                className="max-h-52 overflow-y-auto overscroll-contain divide-y divide-slate-100"
              >
                {filtered.length === 0 ? (
                  <li
                    role="status"
                    className="px-4 py-4 text-xs text-hospital-textMuted text-center italic"
                  >
                    No country found
                  </li>
                ) : (
                  filtered.map((c, idx) => {
                    const isSelected = c.code === activeCountry.code;
                    const isFocused = idx === focusedIndex;
                    const optionId = `${idPrefix}-opt-${c.code}`;
                    return (
                      <li
                        key={c.code}
                        id={optionId}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => selectCountry(c)}
                        className={[
                          "w-full flex items-center gap-3 px-3 py-2.5 min-h-[42px] text-left",
                          "transition-colors cursor-pointer text-xs select-none",
                          isFocused
                            ? "bg-brand-100 text-brand-900"
                            : isSelected
                              ? "bg-brand-50/80 font-semibold text-hospital-textMain"
                              : "hover:bg-slate-50 text-hospital-textMain",
                        ].join(" ")}
                      >
                        <CountryFlag country={c} width={22} height={16} />
                        <span className="flex-1 font-semibold truncate">
                          {c.name}
                        </span>
                        <span className="font-mono font-bold text-hospital-textSubtle text-[11px]">
                          {c.dial}
                        </span>
                        {isSelected && (
                          <Check
                            className="w-3.5 h-3.5 text-brand-600 shrink-0"
                            aria-hidden="true"
                          />
                        )}
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          )}
        </div>

        {/* Local number input */}
        <input
          id={inputId}
          type="tel"
          value={localNumber}
          onChange={(e) => {
            // Live-sanitize typed input to valid phone characters
            const sanitized = e.target.value.replace(/[^\d\s\-()]/g, "");
            onLocalNumberChange(sanitized);
          }}
          onBlur={() => {
            // Automatically strip trunk zero on blur if user entered e.g. 0300...
            if (localNumber.trim().startsWith("0")) {
              onLocalNumberChange(stripLeadingZero(localNumber));
            }
          }}
          placeholder={placeholder || activeCountry.placeholder || "300 123 4567"}
          disabled={disabled}
          aria-label="Local phone number"
          aria-describedby={error ? errorId : undefined}
          aria-invalid={!!error}
          inputMode="tel"
          className={[
            "flex-1 px-3 sm:px-4 py-3 min-h-[52px] rounded-r-xl",
            "bg-transparent text-hospital-textMain",
            "placeholder:text-hospital-textSubtle/60",
            "text-sm sm:text-base font-semibold",
            "focus:outline-none min-w-0",
            "disabled:opacity-50",
          ].join(" ")}
        />

        {/* Phone icon */}
        <div className="flex items-center pr-3.5" aria-hidden="true">
          <Phone className="w-4 h-4 text-hospital-textSubtle" />
        </div>
      </div>

      {/* ── Error message ───────────────────────────────────────────────── */}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-red-600 font-semibold pl-1">
          {error}
        </p>
      )}

      {/* ── Live preview ────────────────────────────────────────────────── */}
      {showPreview && localNumber.trim() && !error && (
        <p className="text-xs text-hospital-textSubtle font-mono pl-1" aria-live="polite">
          Will be saved as:{" "}
          <span className="font-bold text-brand-700">{combinedPhone}</span>
        </p>
      )}
    </div>
  );
}

export default PhoneInput;
