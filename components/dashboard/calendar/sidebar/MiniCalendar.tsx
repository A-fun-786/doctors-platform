import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MiniCalDayItem } from "../types";
import { MINI_CAL_DAY_LABELS } from "../constants";
import { parseYYYYMMDD } from "../calendarUtils";

interface MiniCalendarProps {
  miniCalMonth: Date;
  setMiniCalMonth: React.Dispatch<React.SetStateAction<Date>>;
  miniCalDays: MiniCalDayItem[];
  onSelectDate: (dateStr: string) => void;
  onToday?: () => void;
}

export default function MiniCalendar({
  miniCalMonth,
  setMiniCalMonth,
  miniCalDays,
  onSelectDate,
  onToday,
}: MiniCalendarProps) {
  const handlePrevMonth = () => {
    const prev = new Date(miniCalMonth.getFullYear(), miniCalMonth.getMonth() - 1, 1);
    setMiniCalMonth(prev);
  };

  const handleNextMonth = () => {
    const next = new Date(miniCalMonth.getFullYear(), miniCalMonth.getMonth() + 1, 1);
    setMiniCalMonth(next);
  };

  const handleDateClick = (item: MiniCalDayItem) => {
    onSelectDate(item.dateStr);
    if (!item.isCurrentMonth) {
      const d = parseYYYYMMDD(item.dateStr);
      setMiniCalMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs select-none">
      {/* Header: Month Year + Quick Today + Month Arrows (Google Calendar Style) */}
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-sm font-bold text-slate-800 tracking-tight">
          {miniCalMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="w-7 h-7 flex items-center justify-center hover:bg-slate-100 rounded-full text-slate-600 transition-colors"
            title="Previous Month"
            aria-label="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="w-7 h-7 flex items-center justify-center hover:bg-slate-100 rounded-full text-slate-600 transition-colors"
            title="Next Month"
            aria-label="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Days of Week Header: Google Calendar M T W T F S S */}
      <div className="grid grid-cols-7 text-center mb-1.5">
        {MINI_CAL_DAY_LABELS.map((label, idx) => (
          <span key={`header-${idx}`} className="text-[11px] font-semibold text-slate-400 py-1">
            {label}
          </span>
        ))}
      </div>

      {/* Calendar Days Matrix */}
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {miniCalDays.map((item, idx) => {
          // Google Calendar Date Button Styling
          let buttonClasses = "text-slate-700 hover:bg-slate-100 font-medium";
          let dotColor = "bg-blue-600";

          if (item.isToday && item.isSelected) {
            // Today and Selected: Solid Google blue with white text
            buttonClasses = "bg-blue-600 text-white font-bold shadow-xs scale-105";
            dotColor = "bg-white";
          } else if (item.isToday && !item.isSelected) {
            // Today but another date selected: Highlighted Today indicator circle
            buttonClasses = "border-2 border-blue-600 text-blue-600 font-extrabold bg-blue-50/50 shadow-2xs hover:bg-blue-100/60";
            dotColor = "bg-blue-600";
          } else if (!item.isToday && item.isSelected) {
            // Selected date (not today): Google Calendar soft blue selection circle
            buttonClasses = "bg-blue-100 text-blue-800 font-bold hover:bg-blue-200/80 shadow-2xs";
            dotColor = "bg-blue-700";
          } else if (!item.isCurrentMonth) {
            // Outside current month
            buttonClasses = "text-slate-400 hover:bg-slate-100 hover:text-slate-600 font-normal";
            dotColor = "bg-slate-400";
          }

          return (
            <div
              key={item.dateStr || `day-${idx}`}
              className={`flex items-center justify-center p-0.5 ${
                item.isInCurrentWeek ? "bg-slate-50/60 first:rounded-l-full last:rounded-r-full" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => handleDateClick(item)}
                title={item.dateStr}
                aria-label={item.dateStr}
                className={`w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-full text-xs transition-all flex flex-col items-center justify-center relative cursor-pointer ${buttonClasses}`}
              >
                <span>{item.dayNum}</span>
                {item.hasEvents && (
                  <span
                    className={`w-1 h-1 rounded-full absolute bottom-0.5 ${dotColor}`}
                    title="Has appointments"
                  />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
