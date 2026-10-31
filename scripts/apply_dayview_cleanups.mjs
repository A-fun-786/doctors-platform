import fs from 'fs';

const dayViewPath = 'components/dashboard/calendar/views/DayView.tsx';
let dayView = fs.readFileSync(dayViewPath, 'utf8');

// 1. Remove #APT-101 badge from appointment slot (lines 185-187)
dayView = dayView.replace(
  `<span className="text-xs font-bold font-mono text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-md shrink-0">
                      #{event.appointment_id?.slice(-3) || "APT"}
                    </span>`,
  ''
);

// 2. Add subtle thin line divider on schedule/shift change
// We track previous shift name across workingTimeRows
const oldMapRegex = /workingTimeRows\.map\(\(timeRow\) => \{([\s\S]*?const \{ start: slotStart, end: slotEnd \} = getTimeRowRange\(timeRow\);[\s\S]*?const prefStyles = getSlotShiftTheme\(slotStart, workingHoursConfig\);)/;

const newMapCode = `(() => {
              let prevShiftName: string | null = null;
              return workingTimeRows.map((timeRow, rowIndex) => {
                const { start: slotStart, end: slotEnd } = getTimeRowRange(timeRow);
                const prefStyles = getSlotShiftTheme(slotStart, workingHoursConfig);
                const isShiftChange = rowIndex > 0 && prevShiftName !== null && prevShiftName !== prefStyles.name;
                prevShiftName = prefStyles.name;`;

dayView = dayView.replace(oldMapRegex, newMapCode);

// Wrap returned elements inside a React.Fragment with the thin line divider if isShiftChange is true
dayView = dayView.replace(
  '// 1. Booked Patient Appointment\n              if (apptEvent) {',
  `// Thin line divider on schedule transition (pure line, no timing/text)
                const shiftDivider = isShiftChange ? (
                  <div key={\`divider-\${timeRow}\`} className="py-2">
                    <div className="border-t border-slate-200 w-full" />
                  </div>
                ) : null;

                // 1. Booked Patient Appointment
                if (apptEvent) {`
);

// Update all returns to include shiftDivider
dayView = dayView.replace(
  'return (\n                  <div\n                    key={timeRow}\n                    onClick={() => onEventClick(event, selectedDate)}',
  'return (\n                  <React.Fragment key={timeRow}>\n                    {shiftDivider}\n                    <div\n                      onClick={() => onEventClick(event, selectedDate)}'
);

dayView = dayView.replace(
  '// 2. Doctor Leave or Clinic Holiday\n              if (leaveEvent) {\n                const event = leaveEvent;\n                return (\n                  <div\n                    key={timeRow}',
  '// 2. Doctor Leave or Clinic Holiday\n              if (leaveEvent) {\n                const event = leaveEvent;\n                return (\n                  <React.Fragment key={timeRow}>\n                    {shiftDivider}\n                    <div'
);

dayView = dayView.replace(
  '// 3. Blocked Interval\n              if (blockedEvent) {\n                const event = blockedEvent;\n                return (\n                  <div\n                    key={timeRow}',
  '// 3. Blocked Interval\n              if (blockedEvent) {\n                const event = blockedEvent;\n                return (\n                  <React.Fragment key={timeRow}>\n                    {shiftDivider}\n                    <div'
);

dayView = dayView.replace(
  '// 4. Clean Empty Slot (Preference-colored border, zero text clutter)\n              return (\n                <div\n                  key={timeRow}',
  '// 4. Clean Empty Slot (Preference-colored border, zero text clutter)\n              return (\n                <React.Fragment key={timeRow}>\n                  {shiftDivider}\n                  <div'
);

// Close React.Fragment for all 4 returns
dayView = dayView.replace(
  '</div>\n                );\n              }\n\n              // 2. Doctor Leave',
  '</div>\n                  </React.Fragment>\n                );\n              }\n\n              // 2. Doctor Leave'
);

dayView = dayView.replace(
  '</div>\n                );\n              }\n\n              // 3. Blocked Interval',
  '</div>\n                  </React.Fragment>\n                );\n              }\n\n              // 3. Blocked Interval'
);

dayView = dayView.replace(
  '</div>\n                );\n              }\n\n              // 4. Clean Empty Slot',
  '</div>\n                  </React.Fragment>\n                );\n              }\n\n              // 4. Clean Empty Slot'
);

dayView = dayView.replace(
  '</div>\n                );\n            })\n          )}',
  '</div>\n                </React.Fragment>\n              );\n            });\n          })())\n        }'
);

fs.writeFileSync(dayViewPath, dayView, 'utf8');
console.log('DayView updated with pure thin line and clean slots');

