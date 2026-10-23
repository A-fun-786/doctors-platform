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
import AddAppointmentModal from "./calendar/modals/AddAppointmentModal";
import BlockTimeModal from "./calendar/modals/BlockTimeModal";
import SlotActionModal from "./calendar/modals/SlotActionModal";
import EditWorkingHoursModal from "./calendar/modals/EditWorkingHoursModal";
import { useCalendarDrawer } from "./calendar/hooks/useCalendarDrawer";
import CalendarDrawer from "./calendar/panels/CalendarDrawer";
import AppointmentDetailsPanel from "./calendar/panels/AppointmentDetailsPanel";
import LeaveDetailsPanel from "./calendar/panels/LeaveDetailsPanel";
import { format12Hour } from "./calendar/calendarUtils";

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
    handleGoToToday,
    getEventsForDate,
    refreshCurrentWeek,
  } = useCalendarData();

  // Modals management hook
  const {
    showAddAppointmentModal,
    setShowAddAppointmentModal,
    showBlockModal,
    setShowBlockModal,
    showSlotActionModal,
    setShowSlotActionModal,
    slotActionInitialTab,
    showEditWorkingHoursModal,
    setShowEditWorkingHoursModal,
    workingHoursConfig,
    openEditWorkingHours,
    handleSaveWorkingHours,
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
    openAddAppointment,
    openBlockModal,
    openSlotActionModal,
    openEventDetails,
    handleAddAppointmentSubmit,
    handleBlockSubmit,
    handleSlotBookingSubmit,
    handleSlotLeaveSubmit,
  } = useCalendarModals();

  // Right-side Drawer Hook
  const { drawerState, openEventDrawer, closeDrawer } = useCalendarDrawer();

  // Quick slot create on hover in WeekView
  const handleQuickAddSlot = useCallback(
    (dateStr: string, start: string, end: string) => {
      openAddAppointment(dateStr, start, end);
    },
    [openAddAppointment]
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
              onEventClick={openEventDrawer}
              onQuickAddSlot={handleQuickAddSlot}
              onEmptySlotClick={openSlotActionModal}
              workingHoursConfig={workingHoursConfig}
            />
          )}

          {viewMode === "day" && (
            <DayView
              selectedDate={selectedDate}
              events={getEventsForDate(selectedDate)}
              onBookPatient={() =>
                openSlotActionModal(selectedDate, "10:00", "10:30", "booking")
              }
              onEmptySlotClick={(date, start, end) =>
                openSlotActionModal(date, start, end, "booking")
              }
              onEventClick={openEventDrawer}
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

        {/* Right Column: Mini Calendar, Working Hours */}
        <CalendarSidebar
          miniCalMonth={miniCalMonth}
          setMiniCalMonth={setMiniCalMonth}
          miniCalDays={miniCalDays}
          onSelectDate={setSelectedDate}
          workingHoursConfig={workingHoursConfig}
          onEditWorkingHours={openEditWorkingHours}
        />
      </div>

      {/* MODAL: Slot Action (Empty slot click -> Book Patient or Doctor Leave) */}
      <SlotActionModal
        isOpen={showSlotActionModal}
        onClose={() => setShowSlotActionModal(false)}
        date={modalDate}
        startTime={modalStartTime}
        endTime={modalEndTime}
        initialTab={slotActionInitialTab}
        submitting={modalSubmitting}
        existingEvents={getEventsForDate(modalDate)}
        onBookPatient={(formData) =>
          handleSlotBookingSubmit(
            formData,
            refreshCurrentWeek,
            showToast,
            getEventsForDate(modalDate)
          )
        }
        onMarkLeave={(formData) =>
          handleSlotLeaveSubmit(
            formData,
            refreshCurrentWeek,
            showToast,
            getEventsForDate(modalDate)
          )
        }
      />

      {/* MODAL: Edit Working Hours */}
      <EditWorkingHoursModal
        isOpen={showEditWorkingHoursModal}
        onClose={() => setShowEditWorkingHoursModal(false)}
        config={workingHoursConfig}
        onSave={(newCfg) => handleSaveWorkingHours(newCfg, showToast)}
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
          handleAddAppointmentSubmit(
            e,
            refreshCurrentWeek,
            showToast,
            getEventsForDate(modalDate)
          )
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
        onSubmit={(e) =>
          handleBlockSubmit(
            e,
            refreshCurrentWeek,
            showToast,
            getEventsForDate(modalDate)
          )
        }
      />

      {/* RIGHT-SIDE DRAWER: Patient Appointment Slot Details & Rescheduling OR Doctor Leave Management */}
      <CalendarDrawer
        isOpen={drawerState.isOpen}
        onClose={closeDrawer}
        categoryBadge={
          drawerState.type === "appointment" ? (
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
              Patient Appointment
            </span>
          ) : (
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
              Doctor Leave &amp; Exclusion
            </span>
          )
        }
        title={
          drawerState.type === "appointment"
            ? drawerState.event?.patient_name || "Patient Appointment"
            : drawerState.event?.type === "LEAVE"
            ? "Doctor Leave"
            : drawerState.event?.type === "HOLIDAY"
            ? "Clinic Holiday"
            : "Blocked Time"
        }
        subtitle={
          drawerState.event
            ? `${drawerState.date} • ${format12Hour(drawerState.event.start)} – ${format12Hour(
                drawerState.event.end
              )}`
            : undefined
        }
      >
        {drawerState.type === "appointment" && drawerState.event && (
          <AppointmentDetailsPanel
            event={drawerState.event}
            date={drawerState.date}
            doctorUuid={doctor?.id}
            onClose={closeDrawer}
            onRefreshCalendar={refreshCurrentWeek}
            showToast={showToast}
            existingEvents={getEventsForDate(drawerState.date)}
            workingHoursConfig={workingHoursConfig}
          />
        )}

        {(drawerState.type === "leave" || drawerState.type === "blocked") &&
          drawerState.event && (
            <LeaveDetailsPanel
              event={drawerState.event}
              date={drawerState.date}
              doctorUuid={doctor?.id}
              onClose={closeDrawer}
              onRefreshCalendar={refreshCurrentWeek}
              showToast={showToast}
            />
          )}
      </CalendarDrawer>
    </div>
  );
}
