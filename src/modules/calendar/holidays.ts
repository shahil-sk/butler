import type { CalendarEvent } from "@/shared/types";
import { generateId } from "@/shared/utils";

// A basic set of static holidays for demonstration
const MOCK_HOLIDAYS: Record<string, string[]> = {
  "01-01": ["New Year's Day"],
  "02-14": ["Valentine's Day"],
  "03-17": ["St. Patrick's Day"],
  "04-01": ["April Fools' Day"],
  "04-22": ["Earth Day"],
  "05-05": ["Cinco de Mayo"],
  "07-04": ["Independence Day"],
  "10-31": ["Halloween"],
  "11-11": ["Veterans Day"],
  "12-24": ["Christmas Eve"],
  "12-25": ["Christmas Day"],
  "12-31": ["New Year's Eve"],
};

export function getHolidaysInRange(from: string, to: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const fromDate = new Date(from);
  const toDate = new Date(to);

  // We iterate day by day in the range and check MOCK_HOLIDAYS
  const curr = new Date(fromDate);
  curr.setHours(0, 0, 0, 0);

  while (curr <= toDate) {
    const month = String(curr.getMonth() + 1).padStart(2, '0');
    const day = String(curr.getDate()).padStart(2, '0');
    const year = curr.getFullYear();
    const mmdd = `${month}-${day}`;
    
    if (MOCK_HOLIDAYS[mmdd]) {
      const dateStr = `${year}-${mmdd}`;
      MOCK_HOLIDAYS[mmdd].forEach((name) => {
        events.push({
          id: `holiday-${dateStr}-${name}`,
          title: name,
          startAt: `${dateStr}T00:00:00`,
          endAt: `${dateStr}T23:59:59`,
          startDatetime: `${dateStr}T00:00:00`,
          endDatetime: `${dateStr}T23:59:59`,
          isAllDay: true,
          allDay: true,
          calendarId: "holidays",
          isTimeBlock: false,
          color: "#8b5cf6", // Purple for holidays
          createdAt: dateStr,
          updatedAt: dateStr,
        } as CalendarEvent);
      });
    }

    curr.setDate(curr.getDate() + 1);
  }

  // Add floating holidays (e.g. Thanksgiving is 4th Thursday in Nov)
  // For simplicity, we just add the static ones above, which covers basic needs.
  return events;
}
