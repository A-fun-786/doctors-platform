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
  formatDateToYYYYMMDD,
  parseYYYYMMDD,
} from "../calendarUtils";

export function useCalendarData() {
  // Initialize to current real calendar date
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return formatDateToYYYYMMDD(new Date());
  });
  const [viewMode, setViewMode] = useState<CalendarViewMode>("week");
  const [loading, setLoading] = useState(false);
  const [apiCalendarData, setApiCalendarData] = useState<Record<string, CalendarEvent[]>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Mini Calendar Month Navigation initialized to current month
  const [miniCalMonth, setMiniCalMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  // Jump immediately to today's real date, centering week and mini-calendar
  const handleGoToToday = useCallback(() => {
    const now = new Date();
    const today = formatDateToYYYYMMDD(now);
    setSelectedDate(today);
    setMiniCalMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    logger.action("Calendar", "Navigated to today", { today });
  }, []);

  // Compute 7 days of the selected week (Monday to Sunday)
  const currentWeekDays: WeekDayItem[] = useMemo(() => {
    return generateWeekDays(selectedDate);
  }, [selectedDate]);

  // Compute week range title e.g. "Oct 19 – 25, 2026"
  const weekRangeTitle = useMemo(() => {
    return computeWeekRangeTitle(currentWeekDays);
  }, [currentWeekDays]);

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

  // Mini calendar days generator with event indicator dots
  const miniCalDays: MiniCalDayItem[] = useMemo(() => {
    return generateMiniCalDays(miniCalMonth, selectedDate, getEventsForDate);
  }, [miniCalMonth, selectedDate, getEventsForDate]);

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
    const cur = parseYYYYMMDD(selectedDate);
    cur.setDate(cur.getDate() - 7);
    const newDate = formatDateToYYYYMMDD(cur);
    logger.action("Calendar", "Navigated to previous week", {
      from: selectedDate,
      to: newDate,
    });
    setSelectedDate(newDate);
    // Keep mini calendar aligned to visible month
    setMiniCalMonth((prev) => {
      if (prev.getFullYear() !== cur.getFullYear() || prev.getMonth() !== cur.getMonth()) {
        return new Date(cur.getFullYear(), cur.getMonth(), 1);
      }
      return prev;
    });
  }, [selectedDate]);

  const handleNextWeek = useCallback(() => {
    const cur = parseYYYYMMDD(selectedDate);
    cur.setDate(cur.getDate() + 7);
    const newDate = formatDateToYYYYMMDD(cur);
    logger.action("Calendar", "Navigated to next week", {
      from: selectedDate,
      to: newDate,
    });
    setSelectedDate(newDate);
    // Keep mini calendar aligned to visible month
    setMiniCalMonth((prev) => {
      if (prev.getFullYear() !== cur.getFullYear() || prev.getMonth() !== cur.getMonth()) {
        return new Date(cur.getFullYear(), cur.getMonth(), 1);
      }
      return prev;
    });
  }, [selectedDate]);

  // Selecting a date also updates mini calendar month if needed
  const handleSelectDate = useCallback((dateStr: string) => {
    setSelectedDate(dateStr);
    const d = parseYYYYMMDD(dateStr);
    setMiniCalMonth((prev) => {
      if (prev.getFullYear() !== d.getFullYear() || prev.getMonth() !== d.getMonth()) {
        return new Date(d.getFullYear(), d.getMonth(), 1);
      }
      return prev;
    });
  }, []);

  const refreshCurrentWeek = useCallback(() => {
    if (currentWeekDays.length > 0) {
      fetchCalendar(currentWeekDays[0].dateStr, currentWeekDays[6].dateStr);
    }
  }, [currentWeekDays, fetchCalendar]);

  return {
    selectedDate,
    setSelectedDate: handleSelectDate,
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
    handleGoToToday,
    getEventsForDate,
    refreshCurrentWeek,
  };
}
