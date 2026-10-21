"use client";

import React from "react";
import MiniCalendar from "./MiniCalendar";
import WorkingHoursCard from "./WorkingHoursCard";
import { MiniCalDayItem } from "../types";

interface CalendarSidebarProps {
  miniCalMonth: Date;
  setMiniCalMonth: React.Dispatch<React.SetStateAction<Date>>;
  miniCalDays: MiniCalDayItem[];
  onSelectDate: (dateStr: string) => void;
  onOpenGoogleModal: () => void;
  onAddAppointment: () => void;
  onBlockTime: () => void;
}

export default function CalendarSidebar({
  miniCalMonth,
  setMiniCalMonth,
  miniCalDays,
  onSelectDate,
  onOpenGoogleModal,
  onAddAppointment,
  onBlockTime,
}: CalendarSidebarProps) {
  return (
    <div className="xl:col-span-3 space-y-5">
      <MiniCalendar
        miniCalMonth={miniCalMonth}
        setMiniCalMonth={setMiniCalMonth}
        miniCalDays={miniCalDays}
        onSelectDate={onSelectDate}
      />

      <WorkingHoursCard />

    </div>
  );
}
