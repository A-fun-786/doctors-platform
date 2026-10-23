"use client";

import { useState, useCallback } from "react";
import {
  createDoctorSchedule,
  createAppointment,
  CalendarEvent,
} from "@/lib/api";
import { BlockType, SelectedEventState } from "../types";
import { findConflictingEvents, isIntervalOverlapping } from "../calendarUtils";

export function useCalendarModals() {
  // Modal visibility states
  const [showAddAppointmentModal, setShowAddAppointmentModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<SelectedEventState | null>(null);

  // Common Form states
  const [modalDate, setModalDate] = useState("2026-10-19");
  const [modalStartTime, setModalStartTime] = useState("09:00");
  const [modalEndTime, setModalEndTime] = useState("13:00");
  const [modalSubmitting, setModalSubmitting] = useState(false);

  // New Appointment Form states
  const [newPatientName, setNewPatientName] = useState("");
  const [newPatientContact, setNewPatientContact] = useState("");
  const [newApptReason, setNewApptReason] = useState("");

  // Block Modal Form states
  const [blockType, setBlockType] = useState<BlockType>("BLOCKED");
  const [blockReason, setBlockReason] = useState("");

  // Open modal helpers

  const openAddAppointment = useCallback(
    (date = "2026-10-19", start = "10:00", end = "10:30") => {
      setModalDate(date);
      setModalStartTime(start);
      setModalEndTime(end);
      setShowAddAppointmentModal(true);
    },
    []
  );

  const openBlockModal = useCallback(
    (date = "2026-10-19", start = "10:00", end = "13:00") => {
      setModalDate(date);
      setModalStartTime(start);
      setModalEndTime(end);
      setBlockType("BLOCKED");
      setBlockReason("");
      setShowBlockModal(true);
    },
    []
  );

  const openEventDetails = useCallback((event: CalendarEvent, date: string) => {
    setSelectedEvent({ event, date });
  }, []);

  // Submit handlers
  const handleAddAppointmentSubmit = useCallback(
    async (
      e: React.FormEvent,
      onSuccess: () => void,
      showToast: (msg: string) => void,
      existingEvents: CalendarEvent[] = []
    ) => {
      e.preventDefault();
      const startParts = modalStartTime.split(":").map(Number);
      const endParts = modalEndTime.split(":").map(Number);
      const startM = (startParts[0] || 0) * 60 + (startParts[1] || 0);
      const endM = (endParts[0] || 0) * 60 + (endParts[1] || 0);

      if (endM <= startM) {
        showToast("Invalid time selection: End time must be after start time.");
        return;
      }

      const conflicts = findConflictingEvents(modalStartTime, modalEndTime, existingEvents);
      if (conflicts.length > 0) {
        const first = conflicts[0];
        const conflictLabel = first.patient_name || first.reason || first.type;
        showToast(`Cannot book appointment: Time slot conflicts with ${conflictLabel}.`);
        return;
      }

      setModalSubmitting(true);
      try {
        await createAppointment({
          patient_name: newPatientName,
          patient_contact: newPatientContact || undefined,
          date: modalDate,
          start_time: modalStartTime,
          end_time: modalEndTime,
          reason: newApptReason || undefined,
        });
        showToast(`Appointment booked for ${newPatientName} (${modalStartTime} – ${modalEndTime})!`);
        setShowAddAppointmentModal(false);
        setNewPatientName("");
        setNewPatientContact("");
        setNewApptReason("");
        onSuccess();
      } catch (err: unknown) {
        showToast(err instanceof Error ? err.message : "Failed to book appointment");
      } finally {
        setModalSubmitting(false);
      }
    },
    [
      newPatientName,
      newPatientContact,
      modalDate,
      modalStartTime,
      modalEndTime,
      newApptReason,
    ]
  );

  const handleBlockSubmit = useCallback(
    async (
      e: React.FormEvent,
      onSuccess: () => void,
      showToast: (msg: string) => void,
      existingEvents: CalendarEvent[] = []
    ) => {
      e.preventDefault();
      const startParts = modalStartTime.split(":").map(Number);
      const endParts = modalEndTime.split(":").map(Number);
      const startM = (startParts[0] || 0) * 60 + (startParts[1] || 0);
      const endM = (endParts[0] || 0) * 60 + (endParts[1] || 0);

      if (modalEndTime !== "23:59" && endM <= startM) {
        showToast("Invalid time selection: End time must be after start time.");
        return;
      }

      const conflictingAppointments = existingEvents.filter((ev) => {
        if (ev.type !== "APPOINTMENT" || ev.status === "CANCELLED") return false;
        return isIntervalOverlapping(modalStartTime, modalEndTime, ev.start, ev.end);
      });
      if (conflictingAppointments.length > 0) {
        showToast(`Cannot block time: ${conflictingAppointments.length} appointment(s) already booked during this time.`);
        return;
      }

      setModalSubmitting(true);
      try {
        await createDoctorSchedule({
          date: modalDate,
          start_time: modalStartTime,
          end_time: modalEndTime,
          type: blockType,
          reason: blockReason || undefined,
        });
        showToast(`${blockType} recorded successfully for ${modalDate}!`);
        setShowBlockModal(false);
        setBlockReason("");
        onSuccess();
      } catch (err: unknown) {
        showToast(err instanceof Error ? err.message : "Failed to block time");
      } finally {
        setModalSubmitting(false);
      }
    },
    [modalDate, modalStartTime, modalEndTime, blockType, blockReason]
  );

  return {
    // Visibility
    showAddAppointmentModal,
    setShowAddAppointmentModal,
    showBlockModal,
    setShowBlockModal,
    selectedEvent,
    setSelectedEvent,

    // Form fields
    modalDate,
    setModalDate,
    modalStartTime,
    setModalStartTime,
    modalEndTime,
    setModalEndTime,
    modalSubmitting,
    newPatientName,
    setNewPatientName,
    newPatientContact,
    setNewPatientContact,
    newApptReason,
    setNewApptReason,
    blockType,
    setBlockType,
    blockReason,
    setBlockReason,

    // Actions
    openAddAppointment,
    openBlockModal,
    openEventDetails,
    handleAddAppointmentSubmit,
    handleBlockSubmit,
  };
}
