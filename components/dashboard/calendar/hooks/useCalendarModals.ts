"use client";

import { useState, useCallback } from "react";
import {
  createDoctorSchedule,
  createAppointment,
  CalendarEvent,
} from "@/lib/api";
import { BlockType, SelectedEventState } from "../types";

export function useCalendarModals() {
  // Modal visibility states
  const [showAddAvailabilityModal, setShowAddAvailabilityModal] = useState(false);
  const [showAddAppointmentModal, setShowAddAppointmentModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showGoogleModal, setShowGoogleModal] = useState(false);
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
  const openAddAvailability = useCallback(
    (date = "2026-10-19", start = "10:00", end = "13:00") => {
      setModalDate(date);
      setModalStartTime(start);
      setModalEndTime(end);
      setShowAddAvailabilityModal(true);
    },
    []
  );

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

  const openGoogleModal = useCallback(() => {
    setShowGoogleModal(true);
  }, []);

  const openEventDetails = useCallback((event: CalendarEvent, date: string) => {
    setSelectedEvent({ event, date });
  }, []);

  // Submit handlers
  const handleAddAvailabilitySubmit = useCallback(
    async (
      e: React.FormEvent,
      onSuccess: () => void,
      showToast: (msg: string) => void
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
      if (endM - startM < 30) {
        showToast("Invalid duration: Minimum availability interval is 30 minutes.");
        return;
      }

      setModalSubmitting(true);
      try {
        await createDoctorSchedule({
          date: modalDate,
          start_time: modalStartTime,
          end_time: modalEndTime,
          type: "AVAILABLE",
        });
        showToast("Availability added successfully!");
        setShowAddAvailabilityModal(false);
        onSuccess();
      } catch (err: unknown) {
        showToast(err instanceof Error ? err.message : "Failed to add availability");
      } finally {
        setModalSubmitting(false);
      }
    },
    [modalDate, modalStartTime, modalEndTime]
  );

  const handleAddAppointmentSubmit = useCallback(
    async (
      e: React.FormEvent,
      onSuccess: () => void,
      showToast: (msg: string) => void
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
      showToast: (msg: string) => void
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
    showAddAvailabilityModal,
    setShowAddAvailabilityModal,
    showAddAppointmentModal,
    setShowAddAppointmentModal,
    showBlockModal,
    setShowBlockModal,
    showGoogleModal,
    setShowGoogleModal,
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
    openAddAvailability,
    openAddAppointment,
    openBlockModal,
    openGoogleModal,
    openEventDetails,
    handleAddAvailabilitySubmit,
    handleAddAppointmentSubmit,
    handleBlockSubmit,
  };
}
