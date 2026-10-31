import fs from 'fs';

const code = fs.readFileSync('components/dashboard/calendar/calendarUtils.ts', 'utf8');

const additions = `
export interface ShiftThemeStyle {
  name: string;
  badgeLabel: string;
  pillBg: string;
  pillText: string;
  pillBorder: string;
  indicator: string;
  timeBg: string;
  timeText: string;
  bookedBorder: string;
  emptyCard: string;
  emptySlot: string;
  emptyTimeText: string;
  plusBtn: string;
  plusIcon: string;
  apptBorder: string;
}

export const SHIFT_THEME_PALETTES: ShiftThemeStyle[] = [
  // Shift 1: Warm Amber
  {
    name: 'Shift 1',
    badgeLabel: 'Schedule 1',
    pillBg: 'bg-amber-50',
    pillText: 'text-amber-900',
    pillBorder: 'border-amber-300',
    indicator: 'bg-amber-500',
    timeBg: 'bg-amber-50/50',
    timeText: 'text-amber-950 font-bold',
    bookedBorder: 'border-2 border-amber-400 bg-amber-50/20 hover:border-amber-500',
    emptyCard: 'border-2 border-dashed border-amber-300 bg-amber-50/15 hover:bg-amber-50/40 hover:border-amber-400',
    emptySlot: 'border-2 border-dashed border-amber-300 bg-amber-50/15 hover:bg-amber-50/40 hover:border-amber-400 text-amber-700',
    emptyTimeText: 'text-slate-700 group-hover:text-amber-950',
    plusBtn: 'border-amber-300 text-amber-600 group-hover:border-amber-500 group-hover:text-amber-700',
    plusIcon: 'text-amber-600 group-hover/slot:text-amber-700',
    apptBorder: 'border-l-[4px] border-l-amber-500 border-amber-300 bg-amber-50/40 hover:border-amber-400',
  },
  // Shift 2: Sky Blue
  {
    name: 'Shift 2',
    badgeLabel: 'Schedule 2',
    pillBg: 'bg-sky-50',
    pillText: 'text-sky-900',
    pillBorder: 'border-sky-300',
    indicator: 'bg-sky-500',
    timeBg: 'bg-sky-50/50',
    timeText: 'text-sky-950 font-bold',
    bookedBorder: 'border-2 border-sky-400 bg-sky-50/20 hover:border-sky-500',
    emptyCard: 'border-2 border-dashed border-sky-300 bg-sky-50/15 hover:bg-sky-50/40 hover:border-sky-400',
    emptySlot: 'border-2 border-dashed border-sky-300 bg-sky-50/15 hover:bg-sky-50/40 hover:border-sky-400 text-sky-700',
    emptyTimeText: 'text-slate-700 group-hover:text-sky-950',
    plusBtn: 'border-sky-300 text-sky-600 group-hover:border-sky-500 group-hover:text-sky-700',
    plusIcon: 'text-sky-600 group-hover/slot:text-sky-700',
    apptBorder: 'border-l-[4px] border-l-sky-500 border-sky-300 bg-sky-50/40 hover:border-sky-400',
  },
  // Shift 3: Emerald Green
  {
    name: 'Shift 3',
    badgeLabel: 'Schedule 3',
    pillBg: 'bg-emerald-50',
    pillText: 'text-emerald-900',
    pillBorder: 'border-emerald-300',
    indicator: 'bg-emerald-500',
    timeBg: 'bg-emerald-50/50',
    timeText: 'text-emerald-950 font-bold',
    bookedBorder: 'border-2 border-emerald-400 bg-emerald-50/20 hover:border-emerald-500',
    emptyCard: 'border-2 border-dashed border-emerald-300 bg-emerald-50/15 hover:bg-emerald-50/40 hover:border-emerald-400',
    emptySlot: 'border-2 border-dashed border-emerald-300 bg-emerald-50/15 hover:bg-emerald-50/40 hover:border-emerald-400 text-emerald-700',
    emptyTimeText: 'text-slate-700 group-hover:text-emerald-950',
    plusBtn: 'border-emerald-300 text-emerald-600 group-hover:border-emerald-500 group-hover:text-emerald-700',
    plusIcon: 'text-emerald-600 group-hover/slot:text-emerald-700',
    apptBorder: 'border-l-[4px] border-l-emerald-500 border-emerald-300 bg-emerald-50/40 hover:border-emerald-400',
  },
  // Shift 4: Royal Violet
  {
    name: 'Shift 4',
    badgeLabel: 'Schedule 4',
    pillBg: 'bg-purple-50',
    pillText: 'text-purple-900',
    pillBorder: 'border-purple-300',
    indicator: 'bg-purple-500',
    timeBg: 'bg-purple-50/50',
    timeText: 'text-purple-950 font-bold',
    bookedBorder: 'border-2 border-purple-400 bg-purple-50/20 hover:border-purple-500',
    emptyCard: 'border-2 border-dashed border-purple-300 bg-purple-50/15 hover:bg-purple-50/40 hover:border-purple-400',
    emptySlot: 'border-2 border-dashed border-purple-300 bg-purple-50/15 hover:bg-purple-50/40 hover:border-purple-400 text-purple-700',
    emptyTimeText: 'text-slate-700 group-hover:text-purple-950',
    plusBtn: 'border-purple-300 text-purple-600 group-hover:border-purple-500 group-hover:text-purple-700',
    plusIcon: 'text-purple-600 group-hover/slot:text-purple-700',
    apptBorder: 'border-l-[4px] border-l-purple-500 border-purple-300 bg-purple-50/40 hover:border-purple-400',
  },
];

/**
 * Dynamically resolves slot border & styling based on the specific shift schedule window it belongs to.
 */
export function getSlotShiftTheme(time24: string, config?: WorkingHoursConfig): ShiftThemeStyle {
  const activeConfig = config || DEFAULT_WORKING_HOURS;
  const slotM = timeToMinutes(time24);
  const enabledShifts = activeConfig.shifts.filter((s) => s.enabled);
  const matchedIndex = enabledShifts.findIndex((shift) => {
    const startM = timeToMinutes(shift.start);
    const endM = timeToMinutes(shift.end);
    return slotM >= startM && slotM < endM;
  });

  if (matchedIndex !== -1) {
    const palette = SHIFT_THEME_PALETTES[matchedIndex % SHIFT_THEME_PALETTES.length];
    return {
      ...palette,
      name: enabledShifts[matchedIndex].label || palette.name,
      badgeLabel: enabledShifts[matchedIndex].label || palette.badgeLabel,
    };
  }

  return SHIFT_THEME_PALETTES[0];
}
`;

fs.writeFileSync('components/dashboard/calendar/calendarUtils.ts', code.trim() + '\n\n' + additions.trim() + '\n', 'utf8');
console.log('Appended to calendarUtils successfully');

