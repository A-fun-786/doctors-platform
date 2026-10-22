"use client";

import React from "react";
import MiniCalendar from "./MiniCalendar";
import WorkingHoursCard from "./WorkingHoursCard";
import QuickActionsCard from "./QuickActionsCard";
import { MiniCalDayItem } from "../types";
import { WorkingHoursConfig } from "../calendarUtils";

interface CalendarSidebarProps {
  miniCalMonth: Date;
  setMiniCalMonth: React.Dispatch<React.SetStateAction<Date>>;
  miniCalDays: MiniCalDayItem[];
  onSelectDate: (dateStr: string) => void;
  onAddAppointment: () => void;
  onBlockTime: () => void;
  workingHoursConfig?: WorkingHoursConfig;
  onEditWorkingHours?: () => void;
  selectedDate?: string;
  onToday?: () => void;
}

export default function CalendarSidebar({
  miniCalMonth,
  setMiniCalMonth,
  miniCalDays,
  onSelectDate,
  onAddAppointment,
  onBlockTime,
  workingHoursConfig,
  onEditWorkingHours,
}: CalendarSidebarProps) {
  return (
    <div className="xl:col-span-3 space-y-5 select-none">
      {/* Real Google Calendar Mini-Calendar */}
      <MiniCalendar
        miniCalMonth={miniCalMonth}
        setMiniCalMonth={setMiniCalMonth}
        miniCalDays={miniCalDays}
        onSelectDate={onSelectDate}
      />

      {/* Working Hours Schedule */}
      <WorkingHoursCard
        config={workingHoursConfig}
        onEditHours={onEditWorkingHours}
      />

      {/* Quick Actions */}
      <QuickActionsCard
        onAddAppointment={onAddAppointment}
        onBlockTime={onBlockTime}
      />
    </div>
  );
}


