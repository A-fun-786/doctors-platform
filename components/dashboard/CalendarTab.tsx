"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Toast from "@/components/ui/Toast";
import { CalendarTabProps } from "./calendar/types";
import { useCalendarData } from "./calendar/hooks/useCalendarData";
import { useCalendarModals } from "./calendar/hooks/useCalendarModals";
import CalendarHeader from "./calendar/views/CalendarHeader";
import WeekView from "./calendar/views/WeekView";
import DayView from "./calendar/views/DayView";
import MonthView from "./calendar/views/MonthView";
import AgendaView from "./calendar/views/AgendaView";
import CalendarSidebar from "./calendar/sidebar/CalendarSidebar";
import MiniCalendar from "./calendar/sidebar/MiniCalendar";
import WorkingHoursCard from "./calendar/sidebar/WorkingHoursCard";
import MobileBottomSheet from "./calendar/mobile/MobileBottomSheet";
import MobileClinicStatusCapsule from "./calendar/mobile/MobileClinicStatusCapsule";
import MobileHorizonDayStrip from "./calendar/mobile/MobileHorizonDayStrip";
import AddAppointmentModal from "./calendar/modals/AddAppointmentModal";
import BlockTimeModal from "./calendar/modals/BlockTimeModal";
import SlotActionModal from "./calendar/modals/SlotActionModal";
import EditWorkingHoursModal from "./calendar/modals/EditWorkingHoursModal";
import { useCalendarDrawer } from "./calendar/hooks/useCalendarDrawer";
import CalendarDrawer from "./calendar/panels/CalendarDrawer";
import AppointmentDetailsPanel from "./calendar/panels/AppointmentDetailsPanel";
import LeaveDetailsPanel from "./calendar/panels/LeaveDetailsPanel";
import { format12Hour, saveDoctorWorkingHours, parseYYYYMMDD, formatDateToYYYYMMDD } from "./calendar/calendarUtils";
import { getDoctorWorkingHours, getClinicPractitioners, Practitioner } from "@/lib/api";
import { logger } from "@/lib/logger";

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
    getAllEventsForDate,
    ensureDateLoaded,
    refreshCurrentWeek,
    practitionerFilter,
    setPractitionerFilter,
  } = useCalendarData();

  const isStaff = doctor.user_type === "staff";
  const STAFF_DOCTOR_ROLES = ["doctor", "junior doctor", "consultant", "physician", "surgeon", "specialist"];
  const isStaffDoctor = isStaff && STAFF_DOCTOR_ROLES.includes((doctor.role || "").trim().toLowerCase());

  useEffect(() => {
    if (isStaffDoctor && doctor.staff_id) {
      setPractitionerFilter(doctor.staff_id);
    }
  }, [isStaffDoctor, doctor.staff_id, setPractitionerFilter]);

  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);

  useEffect(() => {
    let isMounted = true;
    getClinicPractitioners()
      .then((list) => {
        if (isMounted && list) {
          setPractitioners(list);
        }
      })
      .catch((err) => {
        logger.warn("CalendarTab", "Could not load clinic practitioners for calendar", { error: String(err) });
      });
    return () => {
      isMounted = false;
    };
  }, []);

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
    setWorkingHoursConfig,
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
    selectedStaffId,
    setSelectedStaffId,
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

  // Fetch working hours from backend API on mount, seeding state and updating localStorage as offline cache
  useEffect(() => {
    let isMounted = true;
    getDoctorWorkingHours()
      .then((remoteConfig) => {
        if (isMounted && remoteConfig?.shifts) {
          setWorkingHoursConfig(remoteConfig);
          saveDoctorWorkingHours(remoteConfig);
        }
      })
      .catch((err) => {
        logger.warn("CalendarTab", "Failed to load doctor working hours from server, using local cache", {
          error: String(err),
        });
      });
    return () => {
      isMounted = false;
    };
  }, [setWorkingHoursConfig]);

  // Right-side Drawer Hook
  const { drawerState, openEventDrawer, closeDrawer } = useCalendarDrawer();

  // Ensure full operational calendar events for modalDate or drawer date are pre-loaded in cache
  useEffect(() => {
    if (modalDate) {
      ensureDateLoaded(modalDate);
    }
  }, [modalDate, ensureDateLoaded]);

  useEffect(() => {
    if (drawerState.isOpen && drawerState.date) {
      ensureDateLoaded(drawerState.date);
    }
  }, [drawerState.isOpen, drawerState.date, ensureDateLoaded]);

  // Mobile bottom sheet toggles for MiniCalendar & WorkingHours
  const [showMobileMiniCal, setShowMobileMiniCal] = useState(false);
  const [showMobileWorkingHours, setShowMobileWorkingHours] = useState(false);

  // Canonical staff ID for modals when an empty slot or new appointment is triggered
  const effectiveStaffId = useMemo(() => {
    if (!practitionerFilter || practitionerFilter === "ALL" || practitionerFilter === "PRIMARY" || practitionerFilter === "primary") {
      return "";
    }
    return practitionerFilter;
  }, [practitionerFilter]);

  // Quick slot create on hover in WeekView
  const handleQuickAddSlot = useCallback(
    (dateStr: string, start: string, end: string, slotStaffId?: string) => {
      openAddAppointment(dateStr, start, end, slotStaffId || effectiveStaffId);
    },
    [openAddAppointment, effectiveStaffId]
  );

  // Empty slot click to book or block slot (preserves filtered practitioner)
  const handleEmptySlotClick = useCallback(
    (date: string, start: string, end: string, slotStaffId?: string) => {
      openSlotActionModal(date, start, end, "booking", slotStaffId || effectiveStaffId);
    },
    [openSlotActionModal, effectiveStaffId]
  );

  // Month date click navigates and switches to week view
  const handleMonthDateSelect = useCallback(
    (dateStr: string) => {
      setSelectedDate(dateStr);
      setViewMode("week");
    },
    [setSelectedDate, setViewMode]
  );

  // Intelligent step navigation: 1 day for Agenda/Day, 7 days for Week view
  const handleStepPrev = useCallback(() => {
    if (viewMode === "week") {
      handlePrevWeek();
    } else {
      const cur = parseYYYYMMDD(selectedDate);
      cur.setDate(cur.getDate() - 1);
      const newDate = formatDateToYYYYMMDD(cur);
      setSelectedDate(newDate);
      setMiniCalMonth((prev) => {
        if (prev.getFullYear() !== cur.getFullYear() || prev.getMonth() !== cur.getMonth()) {
          return new Date(cur.getFullYear(), cur.getMonth(), 1);
        }
        return prev;
      });
    }
  }, [viewMode, handlePrevWeek, selectedDate, setSelectedDate, setMiniCalMonth]);

  const handleStepNext = useCallback(() => {
    if (viewMode === "week") {
      handleNextWeek();
    } else {
      const cur = parseYYYYMMDD(selectedDate);
      cur.setDate(cur.getDate() + 1);
      const newDate = formatDateToYYYYMMDD(cur);
      setSelectedDate(newDate);
      setMiniCalMonth((prev) => {
        if (prev.getFullYear() !== cur.getFullYear() || prev.getMonth() !== cur.getMonth()) {
          return new Date(cur.getFullYear(), cur.getMonth(), 1);
        }
        return prev;
      });
    }
  }, [viewMode, handleNextWeek, selectedDate, setSelectedDate, setMiniCalMonth]);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Toast Feedback */}
      <Toast message={toastMessage} type="success" />

      {/* Top Header Bar (Fixed / Sticky on scroll) */}
      <div className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur-md pt-0.5 pb-2 -mt-1">
        <CalendarHeader
          weekRangeTitle={weekRangeTitle}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onPrevWeek={handleStepPrev}
          onNextWeek={handleStepNext}
          onToday={handleGoToToday}
          onBookAppointment={
            isStaffDoctor
              ? undefined
              : () => openAddAppointment(selectedDate, "10:00", "10:30", effectiveStaffId)
          }
          practitioners={practitioners}
          selectedPractitionerId={practitionerFilter}
          onPractitionerChange={isStaffDoctor ? undefined : setPractitionerFilter}
          isStaffDoctor={isStaffDoctor}
        />
      </div>

      {/* Mobile-Only Smart Controls Island (Visible on < xl) */}
      <div className="xl:hidden space-y-3">
        <MobileClinicStatusCapsule
          config={workingHoursConfig}
          onOpenHoursSheet={() => setShowMobileWorkingHours(true)}
        />
        <MobileHorizonDayStrip
          currentWeekDays={currentWeekDays}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          getEventsForDate={getEventsForDate}
          onOpenFullMonth={() => setShowMobileMiniCal(true)}
        />
      </div>

      {/* Main Full-Width Dashboard Layout */}
      <div className="w-full">
        {/* Full-Width Calendar & Appointments Grid */}
        <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {viewMode === "agenda" && (
            <AgendaView
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              currentWeekDays={currentWeekDays}
              getEventsForDate={getEventsForDate}
              onEventClick={openEventDrawer}
              onBookAppointment={
                isStaffDoctor
                  ? undefined
                  : () => openAddAppointment(selectedDate, "10:00", "10:30", effectiveStaffId)
              }
              practitioners={practitioners}
              selectedPractitionerId={practitionerFilter}
              onPractitionerChange={isStaffDoctor ? undefined : setPractitionerFilter}
            />
          )}

          {viewMode === "week" && (
            <WeekView
              currentWeekDays={currentWeekDays}
              onSelectDate={setSelectedDate}
              getEventsForDate={getEventsForDate}
              onEventClick={openEventDrawer}
              onQuickAddSlot={isStaffDoctor ? undefined : handleQuickAddSlot}
              onEmptySlotClick={isStaffDoctor ? undefined : handleEmptySlotClick}
              workingHoursConfig={workingHoursConfig}
            />
          )}

          {viewMode === "day" && (
            <DayView
              selectedDate={selectedDate}
              events={getEventsForDate(selectedDate)}
              workingHoursConfig={workingHoursConfig}
              onBookPatient={
                isStaffDoctor
                  ? undefined
                  : () => handleEmptySlotClick(selectedDate, "10:00", "10:30")
              }
              onEmptySlotClick={isStaffDoctor ? undefined : handleEmptySlotClick}
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

        {/* Right Column: Mini Calendar & Working Hours Schedule */}
        <div className="hidden" aria-hidden="true">
          <CalendarSidebar
            miniCalMonth={miniCalMonth}
            setMiniCalMonth={setMiniCalMonth}
            miniCalDays={miniCalDays}
            onSelectDate={setSelectedDate}
            workingHoursConfig={workingHoursConfig}
            onEditWorkingHours={openEditWorkingHours}
          />
        </div>
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
        existingEvents={getAllEventsForDate(modalDate)}
        selectedStaffId={selectedStaffId}
        setSelectedStaffId={setSelectedStaffId}
        onBookPatient={(formData) =>
          handleSlotBookingSubmit(
            formData,
            refreshCurrentWeek,
            showToast,
            getAllEventsForDate(modalDate)
          )
        }
        onMarkLeave={(formData) =>
          handleSlotLeaveSubmit(
            formData,
            refreshCurrentWeek,
            showToast,
            getAllEventsForDate(modalDate)
          )
        }
        practitioners={practitioners}
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
        existingEvents={getAllEventsForDate(modalDate)}
        selectedStaffId={selectedStaffId}
        setSelectedStaffId={setSelectedStaffId}
        onSubmit={(e) =>
          handleAddAppointmentSubmit(
            e,
            refreshCurrentWeek,
            showToast,
            getAllEventsForDate(modalDate)
          )
        }
        practitioners={practitioners}
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
        existingEvents={getAllEventsForDate(modalDate)}
        onSubmit={(e) =>
          handleBlockSubmit(
            e,
            refreshCurrentWeek,
            showToast,
            getAllEventsForDate(modalDate)
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
            existingEvents={getAllEventsForDate(drawerState.date)}
            workingHoursConfig={workingHoursConfig}
            isStaffDoctor={isStaffDoctor}
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

      {/* MOBILE BOTTOM SHEET: Full Month MiniCalendar */}
      <MobileBottomSheet
        isOpen={showMobileMiniCal}
        onClose={() => setShowMobileMiniCal(false)}
        title="Select Date"
        subtitle="Jump directly to any date or month"
      >
        <div className="max-w-md mx-auto">
          <MiniCalendar
            miniCalMonth={miniCalMonth}
            setMiniCalMonth={setMiniCalMonth}
            miniCalDays={miniCalDays}
            onSelectDate={(dateStr) => {
              setSelectedDate(dateStr);
              setShowMobileMiniCal(false);
            }}
          />
        </div>
      </MobileBottomSheet>

      {/* MOBILE BOTTOM SHEET: Clinic Working Hours */}
      <MobileBottomSheet
        isOpen={showMobileWorkingHours}
        onClose={() => setShowMobileWorkingHours(false)}
        title="Clinic Working Hours"
        subtitle="Operational shift timings and daily slots"
      >
        <div className="max-w-md mx-auto">
          <WorkingHoursCard
            config={workingHoursConfig}
            onEditHours={() => {
              setShowMobileWorkingHours(false);
              openEditWorkingHours();
            }}
          />
        </div>
      </MobileBottomSheet>
    </div>
  );
}
