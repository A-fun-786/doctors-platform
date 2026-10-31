import fs from 'fs';

const weekViewPath = 'components/dashboard/calendar/views/WeekView.tsx';
let weekView = fs.readFileSync(weekViewPath, 'utf8');

// 1. Update imports
weekView = weekView.replace(
  '  timeToMinutes,\n} from "../calendarUtils";',
  '  timeToMinutes,\n  WorkingHoursShift,\n  getSlotShiftTheme,\n  SHIFT_THEME_PALETTES,\n  DEFAULT_WORKING_HOURS,\n} from "../calendarUtils";'
);

// 2. Remove getSlotPreferenceStyles
weekView = weekView.replace(
  /\/\*\*[\s\S]*?function getSlotPreferenceStyles[\s\S]*?^\}/m,
  ''
);

// 3. Update legend bar in WeekView to dynamic schedules
const oldWeekLegendRegex = /\{\/\* Calendar Legend Bar on Top with Preference indicators \*\/\}[\s\S]*?30-Minute Operating Intervals\s*<\/div>\s*<\/div>/;

const newWeekLegend = `{/* Calendar Legend Bar on Top with Dynamic Schedule/Shift indicators */}
        <div className="p-2.5 border-b border-slate-200 bg-slate-50/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {((workingHoursConfig || DEFAULT_WORKING_HOURS).shifts.filter((s: WorkingHoursShift) => s.enabled)).map(
              (shift: WorkingHoursShift, idx: number) => {
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

            <div className="h-3 w-px bg-slate-200 mx-1 hidden sm:block" />

            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-blue-600 border border-blue-700 shrink-0" />
              <span className="font-semibold text-slate-700 text-[11px]">Appointment</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 border border-amber-600 shrink-0" />
              <span className="font-semibold text-slate-700 text-[11px]">Doctor Leave</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-purple-500 border border-purple-600 shrink-0" />
              <span className="font-semibold text-slate-700 text-[11px]">Blocked Period</span>
            </div>
          </div>
          <div className="text-[11px] font-medium text-slate-500">
            Dynamic Schedule Slots
          </div>
        </div>`;

weekView = weekView.replace(oldWeekLegendRegex, newWeekLegend);

// 4. Update slot styles resolution in week grid loop
weekView = weekView.replace(
  'const prefStyles = getSlotPreferenceStyles(slotStart);',
  'const prefStyles = getSlotShiftTheme(slotStart, workingHoursConfig);'
);

fs.writeFileSync(weekViewPath, weekView, 'utf8');
console.log('WeekView updated with dynamic schedule-based colors');

