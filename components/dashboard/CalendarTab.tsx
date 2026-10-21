"use client";

import React, { useCallback } from "react";
import Toast from "@/components/ui/Toast";
import { CalendarTabProps } from "./calendar/types";
import { useCalendarData } from "./calendar/hooks/useCalendarData";
import { useCalendarModals } from "./calendar/hooks/useCalendarModals";
import CalendarHeader from "./calendar/views/CalendarHeader";
import WeekView from "./calendar/views/WeekView";
import DayView from "./calendar/views/DayView";
import MonthView from "./calendar/views/MonthView";
import CalendarSidebar from "./calendar/sidebar/CalendarSidebar";
import AddAvailabilityModal from "./calendar/modals/AddAvailabilityModal";
import AddAppointmentModal from "./calendar/modals/AddAppointmentModal";
import BlockTimeModal from "./calendar/modals/BlockTimeModal";
import EventDetailsModal from "./calendar/modals/EventDetailsModal";

export default function CalendarTab({ doctor, onNavigateTab: _onNavigateTab }: CalendarTabProps) {
  // Calendar data & date state hook
  const {
    selectedDate,
    setSelectedDate,
    viewMode,
    setViewMode,
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
  } = useCalendarData();

  // Modals management hook
  const {
    showAddAvailabilityModal,
    setShowAddAvailabilityModal,
    showAddAppointmentModal,
    setShowAddAppointmentModal,
    showBlockModal,
    setShowBlockModal,
    selectedEvent,
    setSelectedEvent,
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
    openAddAvailability,
    openAddAppointment,
    openBlockModal,
    openEventDetails,
    handleAddAvailabilitySubmit,
    handleAddAppointmentSubmit,
    handleBlockSubmit,
  } = useCalendarModals();

  // Quick slot create on hover in WeekView
  const handleQuickAddSlot = useCallback(
    (dateStr: string, start: string, end: string) => {
      openAddAvailability(dateStr, start, end);
    },
    [openAddAvailability]
  );

  // Month date click navigates and switches to week view
  const handleMonthDateSelect = useCallback(
    (dateStr: string) => {
      setSelectedDate(dateStr);
      setViewMode("week");
    },
    [setSelectedDate, setViewMode]
  );

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      <Toast message={toastMessage} type="success" />

      {/* Top Header Bar */}
      <CalendarHeader
        weekRangeTitle={weekRangeTitle}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onPrevWeek={handlePrevWeek}
        onNextWeek={handleNextWeek}
        onAddAvailability={() => openAddAvailability(selectedDate)}
      />

      {/* Main 2-Column Dashboard Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column: Calendar Main Grid */}
        <div className="xl:col-span-9 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {viewMode === "week" && (
            <WeekView
              currentWeekDays={currentWeekDays}
              onSelectDate={setSelectedDate}
              getEventsForDate={getEventsForDate}
              onEventClick={openEventDetails}
              onAvailableSlotClick={openAddAppointment}
              onQuickAddSlot={handleQuickAddSlot}
            />
          )}

          {viewMode === "day" && (
            <DayView
              selectedDate={selectedDate}
              events={getEventsForDate(selectedDate)}
              onBookPatient={() => openAddAppointment(selectedDate)}
              onEventClick={openEventDetails}
            />
          )}

          {viewMode === "month" && (
            <MonthView
              miniCalDays={miniCalDays}
              getEventsForDate={getEventsForDate}
              onSelectDate={handleMonthDateSelect}
            />
          )}
        </div>

        {/* Right Column: Mini Calendar, Working Hours, Quick Actions */}
        <CalendarSidebar
          miniCalMonth={miniCalMonth}
          setMiniCalMonth={setMiniCalMonth}
          miniCalDays={miniCalDays}
          onSelectDate={setSelectedDate}
          onAddAppointment={() => openAddAppointment(selectedDate)}
          onBlockTime={() => openBlockModal(selectedDate)}
        />
      </div>

      {/* MODAL: Add Availability */}
      <AddAvailabilityModal
        isOpen={showAddAvailabilityModal}
        onClose={() => setShowAddAvailabilityModal(false)}
        date={modalDate}
        setDate={setModalDate}
        startTime={modalStartTime}
        setStartTime={setModalStartTime}
        endTime={modalEndTime}
        setEndTime={setModalEndTime}
        submitting={modalSubmitting}
        existingEvents={getEventsForDate(modalDate)}
        onSubmit={(e) =>
          handleAddAvailabilitySubmit(e, refreshCurrentWeek, showToast)
        }
      />

      {/* MODAL: Add Appointment */}
      <AddAppointmentModal
        isOpen={showAddAppointmentModal}
        onClose={() => setShowAddAppointmentModal(false)}
        patientName={newPatientName}
        setPatientName={setNewPatientName}
        patientContact={newPatientContact}
        setPatientContact={setNewPatientContact}
        date={modalDate}
        setDate={setModalDate}
        startTime={modalStartTime}
        setStartTime={setModalStartTime}
        endTime={modalEndTime}
        setEndTime={setModalEndTime}
        reason={newApptReason}
        setReason={setNewApptReason}
        submitting={modalSubmitting}
        existingEvents={getEventsForDate(modalDate)}
        onSubmit={(e) =>
          handleAddAppointmentSubmit(e, refreshCurrentWeek, showToast)
        }
      />

      {/* MODAL: Block Time / Leave */}
      <BlockTimeModal
        isOpen={showBlockModal}
        onClose={() => setShowBlockModal(false)}
        blockType={blockType}
        setBlockType={setBlockType}
        date={modalDate}
        setDate={setModalDate}
        startTime={modalStartTime}
        setStartTime={setModalStartTime}
        endTime={modalEndTime}
        setEndTime={setModalEndTime}
        reason={blockReason}
        setReason={setBlockReason}
        submitting={modalSubmitting}
        existingEvents={getEventsForDate(modalDate)}
        onSubmit={(e) => handleBlockSubmit(e, refreshCurrentWeek, showToast)}
      />

      {/* MODAL: Event Details */}
      <EventDetailsModal
        selectedEvent={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  );
}
