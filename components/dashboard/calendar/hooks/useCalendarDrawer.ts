"use client";

import { useState, useCallback } from "react";
import { CalendarEvent } from "@/lib/api";
import { CalendarDrawerType, CalendarDrawerState } from "../types";

export function useCalendarDrawer() {
  const [drawerState, setDrawerState] = useState<CalendarDrawerState>({
    isOpen: false,
    type: null,
    mode: "view",
    event: null,
    date: "",
    leaveId: undefined,
  });

  const openEventDrawer = useCallback((event: CalendarEvent, date: string) => {
    let type: CalendarDrawerType = "appointment";
    if (event.type === "LEAVE" || event.type === "HOLIDAY") {
      type = "leave";
    } else if (event.type === "BLOCKED") {
      type = "blocked";
    }

    setDrawerState({
      isOpen: true,
      type,
      mode: "view",
      event,
      date,
      leaveId: event.schedule_id,
    });
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerState((prev) => ({
      ...prev,
      isOpen: false,
    }));
  }, []);

  return {
    drawerState,
    openEventDrawer,
    closeDrawer,
  };
}
