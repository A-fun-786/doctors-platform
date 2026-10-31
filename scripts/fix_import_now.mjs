import fs from 'fs';

let content = fs.readFileSync('components/dashboard/calendar/views/DayView.tsx', 'utf8');
content = content.replace(
  '  timeToMinutes,',
  '  timeToMinutes,\n  WorkingHoursShift,\n  getSlotShiftTheme,\n  SHIFT_THEME_PALETTES,\n  DEFAULT_WORKING_HOURS,'
);
fs.writeFileSync('components/dashboard/calendar/views/DayView.tsx', content, 'utf8');
console.log('Successfully updated DayView imports');

