"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { CalendarEvent, getDoctorCalendar } from "@/lib/api";
import { logger } from "@/lib/logger";
import { CalendarViewMode, WeekDayItem, MiniCalDayItem } from "../types";
import { DEMO_WEEK_EVENTS } from "../constants";
import {
  generateWeekDays,
  computeWeekRangeTitle,
  generateMiniCalDays,
} from "../calendarUtils";

export function useCalendarData() {
  const [selectedDate, setSelectedDate] = useState<string>("2026-10-19");
  const [viewMode, setViewMode] = useState<CalendarViewMode>("week");
  const [loading, setLoading] = useState(false);
  const [apiCalendarData, setApiCalendarData] = useState<Record<string, CalendarEvent[]>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Mini Calendar Month Navigation
  const [miniCalMonth, setMiniCalMonth] = useState<Date>(() => new Date(2026, 9, 1)); // Oct 2026

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  // Compute 7 days of the selected week (Monday to Sunday)
  const currentWeekDays: WeekDayItem[] = useMemo(() => {
    return generateWeekDays(selectedDate);
  }, [selectedDate]);

  // Compute week range title e.g. "Oct 19 – 25, 2026"
  const weekRangeTitle = useMemo(() => {
    return computeWeekRangeTitle(currentWeekDays);
  }, [currentWeekDays]);

  // Mini calendar days generator
  const miniCalDays: MiniCalDayItem[] = useMemo(() => {
    return generateMiniCalDays(miniCalMonth, selectedDate);
  }, [miniCalMonth, selectedDate]);

  // Fetch live operational calendar from backend API
  const fetchCalendar = useCallback(async (startIso: string, endIso: string) => {
    try {
      setLoading(true);
      const res = await getDoctorCalendar(startIso, endIso);
      const map: Record<string, CalendarEvent[]> = {};
      let totalEvents = 0;
      res.dates?.forEach((d) => {
        if (d.date && d.events) {
          map[d.date] = d.events;
          totalEvents += d.events.length;
        }
      });
      setApiCalendarData(map);
      logger.info("Calendar", `Loaded operational calendar for ${startIso} to ${endIso}`, {
        datesCount: res.dates?.length || 0,
        totalEvents,
      });
    } catch (err: unknown) {
      logger.warn("Calendar", "Backend calendar fetch notice, using fallback view", {
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentWeekDays.length > 0) {
      const start = currentWeekDays[0].dateStr;
      const end = currentWeekDays[6].dateStr;
      fetchCalendar(start, end);
    }
  }, [currentWeekDays, fetchCalendar]);

  // Navigate week
  const handlePrevWeek = useCallback(() => {
    const cur = new Date(selectedDate);
    cur.setDate(cur.getDate() - 7);
    const newDate = cur.toISOString().split("T")[0];
    logger.action("Calendar", "Navigated to previous week", {
      from: selectedDate,
      to: newDate,
    });
    setSelectedDate(newDate);
  }, [selectedDate]);

  const handleNextWeek = useCallback(() => {
    const cur = new Date(selectedDate);
    cur.setDate(cur.getDate() + 7);
    const newDate = cur.toISOString().split("T")[0];
    logger.action("Calendar", "Navigated to next week", {
      from: selectedDate,
      to: newDate,
    });
    setSelectedDate(newDate);
  }, [selectedDate]);


  // Merge backend events with visual demo schedule
  const getEventsForDate = useCallback(
    (dateStr: string): CalendarEvent[] => {
      const liveEvents = apiCalendarData[dateStr];
      if (liveEvents && liveEvents.length > 0) {
        return liveEvents;
      }
      return DEMO_WEEK_EVENTS[dateStr] || [];
    },
    [apiCalendarData]
  );

  const refreshCurrentWeek = useCallback(() => {
    if (currentWeekDays.length > 0) {
      fetchCalendar(currentWeekDays[0].dateStr, currentWeekDays[6].dateStr);
    }
  }, [currentWeekDays, fetchCalendar]);

  return {
    selectedDate,
    setSelectedDate,
    viewMode,
    setViewMode,
    loading,
    toastMessage,
    showToast,
    miniCalMonth,
    setMiniCalMonth,
    currentWeekDays,
    weekRangeTitle,
    miniCalDays,
    handlePrevWeek,
    handleNextWeek,
    getEventsForDate,
    refreshCurrentWeek,
  };
}
