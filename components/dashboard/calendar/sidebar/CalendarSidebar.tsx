"use client";

import React from "react";
import MiniCalendar from "./MiniCalendar";
import WorkingHoursCard from "./WorkingHoursCard";
import GoogleCalendarCard from "./GoogleCalendarCard";
import QuickActionsCard from "./QuickActionsCard";
import SyncNotificationBanner from "./SyncNotificationBanner";
import { MiniCalDayItem } from "../types";

interface CalendarSidebarProps {
  miniCalMonth: Date;
  setMiniCalMonth: React.Dispatch<React.SetStateAction<Date>>;
  miniCalDays: MiniCalDayItem[];
  onSelectDate: (dateStr: string) => void;
  onOpenGoogleModal: () => void;
  onAddAppointment: () => void;
  onBlockTime: () => void;
  onSyncGoogle: () => void;
  syncingGoogle: boolean;
}

export default function CalendarSidebar({
  miniCalMonth,
  setMiniCalMonth,
  miniCalDays,
  onSelectDate,
  onOpenGoogleModal,
  onAddAppointment,
  onBlockTime,
  onSyncGoogle,
  syncingGoogle,
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

      <GoogleCalendarCard onManage={onOpenGoogleModal} />

      <QuickActionsCard
        onAddAppointment={onAddAppointment}
        onBlockTime={onBlockTime}
        onSyncGoogle={onSyncGoogle}
        syncingGoogle={syncingGoogle}
      />

      <SyncNotificationBanner />
    </div>
  );
}
