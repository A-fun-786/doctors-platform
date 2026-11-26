"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { ChevronDown, Search, Check, AlertCircle } from "lucide-react";
import { CountryFlag } from "@/components/ui/CountryFlag";
import {
  COUNTRY_DIAL_CODES,
  CountryDialCode,
  DEFAULT_COUNTRY_ISO,
  formatPhoneWithCountry,
  getCountryByIso,
  getLocalPhoneWarning,
  parsePhoneWithCountry,
} from "@/lib/phone";

interface CountryPhoneInputProps {
  value: string;
  onChange: (formattedPhone: string) => void;
  onBlur?: () => void;
  touched?: boolean;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
}

export function CountryPhoneInput({
  value,
  onChange,
  onBlur,
  touched = false,
  required = true,
  disabled = false,
  id,
  ariaLabel = "Mobile Number",
}: CountryPhoneInputProps) {
  const [selectedIso, setSelectedIso] = useState<string>(() => {
    return parsePhoneWithCountry(value, DEFAULT_COUNTRY_ISO).country.iso;
  });
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync country ISO when external value changes (e.g., opening Edit modal for another staff member)
  useEffect(() => {
    if (value && value.trim().startsWith("+")) {
      const parsed = parsePhoneWithCountry(value, selectedIso);
      if (parsed.country.iso !== selectedIso) {
        setSelectedIso(parsed.country.iso);
      }
    } else if (!value) {
      // Keep user-chosen country when input is empty; only reset if needed externally
    }
  }, [value, selectedIso]);

  const selectedCountry = useMemo(() => getCountryByIso(selectedIso), [selectedIso]);
  const localDigits = useMemo(() => {
    const parsed = parsePhoneWithCountry(value, selectedIso);
    return parsed.localDigits;
  }, [value, selectedIso]);

  const warning = useMemo(
    () => getLocalPhoneWarning(localDigits, selectedCountry, Boolean(touched || localDigits.length > 0)),
    [localDigits, selectedCountry, touched]
  );

  const filteredCountries = useMemo(() => {
    const q = countrySearch.trim().toLowerCase();
    if (!q) return COUNTRY_DIAL_CODES;
    return COUNTRY_DIAL_CODES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dialCode.includes(q) ||
        c.iso.toLowerCase().includes(q)
    );
  }, [countrySearch]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setCountrySearch("");
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [dropdownOpen]);

  useEffect(() => {
    if (dropdownOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [dropdownOpen]);

  const handleSelectCountry = (country: CountryDialCode) => {
    setSelectedIso(country.iso);
    setDropdownOpen(false);
    setCountrySearch("");
    const clampedDigits = localDigits.slice(0, country.maxDigits);
    onChange(formatPhoneWithCountry(country, clampedDigits));
  };

  const handleDigitsChange = (raw: string) => {
    const digitsOnly = raw.replace(/\D/g, "").slice(0, selectedCountry.maxDigits);
    onChange(formatPhoneWithCountry(selectedCountry, digitsOnly));
  };

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`flex items-center w-full h-10 bg-white border rounded-xl text-xs font-medium transition-all shadow-2xs ${
          warning
            ? "border-rose-400 focus-within:border-rose-500 focus-within:ring-4 focus-within:ring-rose-400/20 bg-rose-50/20"
            : "border-slate-200 hover:border-slate-300 focus-within:border-brand-600 focus-within:ring-4 focus-within:ring-brand-500/10"
        }`}
      >
        {/* Country Flag + Dial Code Selector */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setDropdownOpen((prev) => !prev)}
          aria-haspopup="listbox"
          aria-expanded={dropdownOpen}
          aria-label={`Country code ${selectedCountry.name} ${selectedCountry.dialCode}`}
          className="h-full px-2.5 flex items-center gap-1.5 border-r border-slate-200 bg-slate-50/70 hover:bg-slate-100/80 rounded-l-xl text-slate-700 font-semibold shrink-0 transition-colors cursor-pointer disabled:opacity-60"
        >
          <CountryFlag iso={selectedCountry.iso} />
          <span className="text-xs font-semibold text-slate-700">{selectedCountry.dialCode}</span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </button>

        {/* Strict Numeric Local Mobile Input */}
        <input
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          required={required}
          disabled={disabled}
          aria-label={ariaLabel}
          maxLength={selectedCountry.maxDigits}
          placeholder={selectedCountry.placeholder}
          value={localDigits}
          onBlur={onBlur}
          onChange={(e) => handleDigitsChange(e.target.value)}
          className={`w-full h-full px-3 bg-transparent rounded-r-xl text-xs font-medium focus:outline-none ${
            warning ? "text-rose-900 placeholder:text-rose-300" : "text-slate-900 placeholder:text-slate-400"
          }`}
        />
      </div>

      {/* A-Z Country Selector Popover */}
      {dropdownOpen && (
        <div
          role="listbox"
          aria-label="Select country code (A-Z)"
          className="absolute z-50 left-0 mt-1.5 w-72 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in duration-100"
        >
          <div className="p-2 border-b border-slate-100 bg-slate-50/60">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={countrySearch}
                onChange={(e) => setCountrySearch(e.target.value)}
                placeholder="Search country A-Z or code..."
                className="w-full h-8 pl-8 pr-2.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-brand-600"
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-50">
            {filteredCountries.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-slate-400">No country found</div>
            ) : (
              filteredCountries.map((country) => {
                const isSelected = country.iso === selectedCountry.iso;
                return (
                  <button
                    key={country.iso}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelectCountry(country)}
                    className={`w-full px-3 py-2 flex items-center justify-between text-left text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-brand-50 text-brand-700 font-semibold"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <CountryFlag iso={country.iso} />
                      <span className="truncate">{country.name}</span>
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0 ml-2">
                      <span className="text-slate-500 font-mono text-[11px]">{country.dialCode}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-brand-600" />}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {warning && (
        <p className="mt-1 text-[11px] text-rose-600 flex items-center gap-1 font-medium animate-in fade-in">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
          <span>{warning}</span>
        </p>
      )}
    </div>
  );
}
