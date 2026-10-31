import fs from 'fs';

const dayViewPath = 'components/dashboard/calendar/views/DayView.tsx';
let dayView = fs.readFileSync(dayViewPath, 'utf8');

// 1. Update imports
dayView = dayView.replace(
  'getWorkingHoursTimeRows,\n  WorkingHoursConfig,\n  timeToMinutes,',
  'getWorkingHoursTimeRows,\n  WorkingHoursConfig,\n  timeToMinutes,\n  getSlotShiftTheme,\n  SHIFT_THEME_PALETTES,\n  DEFAULT_WORKING_HOURS,'
);

// 2. Remove obsolete getSlotPreferenceStyles function
dayView = dayView.replace(
  /\/\*\*[\s\S]*?function getSlotPreferenceStyles[\s\S]*?^\}/m,
  ''
);

// 3. Update legend bar to dynamically show doctor's configured schedules/shifts
const oldLegendRegex = /\{\/\* Calendar Legend Bar on Top with Preference indicators \*\/\}[\s\S]*?30-Minute Operating Intervals\s*<\/div>\s*<\/div>/;

const newLegend = `{/* Calendar Legend Bar on Top with Dynamic Schedule/Shift indicators */}
      <div className="p-2.5 border-b border-slate-200 bg-slate-50/80 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {((workingHoursConfig || DEFAULT_WORKING_HOURS).shifts.filter((s) => s.enabled)).map(
            (shift, idx) => {
              const theme = SHIFT_THEME_PALETTES[idx % SHIFT_THEME_PALETTES.length];
              return (
                <div
                  key={shift.id || idx}
                  className={\`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border \${theme.pillBg} \${theme.pillText} \${theme.pillBorder}\`}
                >
                  <span className={\`w-2 h-2 rounded-full \${theme.indicator} shrink-0\`} />
                  <span className="font-semibold text-[11px]">
                    {shift.label || \`Schedule \${idx + 1}\`} ({format12Hour(shift.start)} – {format12Hour(shift.end)})
                  </span>
                </div>
              );
            }
          )}
        </div>

        <div className="text-[11px] font-medium text-slate-500">
          Dynamic Schedule Slots
        </div>
      </div>`;

dayView = dayView.replace(oldLegendRegex, newLegend);

// 4. In map loop, replace getSlotPreferenceStyles with getSlotShiftTheme
dayView = dayView.replace(
  'const prefStyles = getSlotPreferenceStyles(slotStart);',
  'const prefStyles = getSlotShiftTheme(slotStart, workingHoursConfig);'
);

fs.writeFileSync(dayViewPath, dayView, 'utf8');
console.log('DayView updated with schedule-based colors');

