"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface FAQItem {
  id: number;
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    id: 1,
    question: "How does billing and payment tracking work?",
    answer:
      "You can create quick bills and receipts in seconds for doctor visits, medicines, and tests. It supports cash, UPI, and card payments, and automatically tracks your daily earnings.",
  },
  {
    id: 2,
    question: "Can I set different consultation fees for each doctor?",
    answer:
      "Yes! You can easily set separate consultation fees, follow-up charges, and emergency visit rates for every doctor in your clinic.",
  },
  {
    id: 3,
    question: "Does it work on mobile phones and tablets?",
    answer:
      "Yes, 100%. You and your staff can use it on any smartphone, tablet, laptop, or reception computer without installing any heavy software.",
  },
  {
    id: 4,
    question: "How do patients book appointments or contact the clinic?",
    answer:
      "Patients can visit your clinic website, pick an available doctor and convenient time slot, or get a live queue token. They can also call or chat with your reception directly on WhatsApp.",
  },
  {
    id: 5,
    question: "Can I change doctor timings or services later?",
    answer:
      "Yes, you can update your details at any time. Add new doctors, update visiting hours, change fees, or turn services on and off directly from your dashboard with one click.",
  },
];

export default function FAQ() {
  // Store open item index. Default to null (all collapsed) or toggle on click
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const handleToggle = (idx: number) => {
    setOpenIndex((prev) => (prev === idx ? null : idx));
  };

  return (
    <section id="faq" className="py-20 sm:py-24 bg-white border-t border-slate-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header Matching Uploaded UI */}
        <div className="text-center mb-12 sm:mb-14 space-y-2">
          <p className="text-xs sm:text-sm font-bold tracking-wider text-emerald-600 uppercase">
            QUESTIONS &amp; ANSWERS
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight">
            Frequently Asked Questions
          </h2>
        </div>

        {/* FAQ Accordion List with Instant On-Click Expansion */}
        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;

            return (
              <div
                key={faq.id}
                className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden cursor-pointer ${isOpen
                  ? "border-emerald-300 shadow-sm ring-1 ring-emerald-500/20"
                  : "border-slate-200/80 hover:border-slate-300 shadow-[0_2px_8px_rgba(0,0,0,0.02)]"
                  }`}
                onClick={() => handleToggle(idx)}
              >
                {/* Header Row */}
                <div className="w-full px-6 sm:px-8 py-4 sm:py-5 flex items-center justify-between gap-4 select-none">
                  <span
                    className={`text-sm sm:text-base font-semibold flex-1 leading-snug transition-colors ${isOpen ? "text-emerald-950 font-bold" : "text-slate-800"
                      }`}
                  >
                    {faq.question}
                  </span>

                  {/* Arrow Icon Button that rotates on open */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggle(idx);
                    }}
                    className={`p-1.5 -mr-1.5 rounded-full transition-all duration-200 ${isOpen
                      ? "bg-emerald-50 text-emerald-600 rotate-180"
                      : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                      }`}
                    aria-label={isOpen ? "Collapse answer" : "Expand answer"}
                  >
                    <ChevronDown className="w-5 h-5 shrink-0" />
                  </button>
                </div>

                {/* Collapsible Answer Body */}
                {isOpen && (
                  <div className="px-6 sm:px-8 pb-5 pt-3 text-sm text-slate-600 leading-relaxed border-t border-slate-100 bg-slate-50/50">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
