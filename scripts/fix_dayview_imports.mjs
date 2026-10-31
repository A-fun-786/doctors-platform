import fs from 'fs';

const dayViewPath = 'components/dashboard/calendar/views/DayView.tsx';
let dayView = fs.readFileSync(dayViewPath, 'utf8');

// Replace import cleanly
const oldImport = `import {
  format12Hour,
  getTimeRowRange,
  doesEventOverlapSlot,
  getWorkingHoursTimeRows,
  WorkingHoursConfig,
  timeToMinutes,
} from "../calendarUtils";`;

const newImport = `import {
  format12Hour,
  getTimeRowRange,
  doesEventOverlapSlot,
  getWorkingHoursTimeRows,
  WorkingHoursConfig,
  timeToMinutes,
  getSlotShiftTheme,
  SHIFT_THEME_PALETTES,
  DEFAULT_WORKING_HOURS,
  WorkingHoursShift,
} from "../calendarUtils";`;

dayView = dayView.replace(oldImport, newImport);

// Type annotations for shifts map
dayView = dayView.replace(
  '(shift, idx)',
  '(shift: WorkingHoursShift, idx: number)'
);
dayView = dayView.replace(
  '.filter((s) => s.enabled)',
  '.filter((s: WorkingHoursShift) => s.enabled)'
);

fs.writeFileSync(dayViewPath, dayView, 'utf8');
console.log('Fixed imports and types in DayView');

