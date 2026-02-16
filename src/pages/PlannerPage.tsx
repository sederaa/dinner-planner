import { useMemo, useState } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DATE_LOCALE = "en-NZ";

const startOfMonday = (date: Date) => {
  const monday = new Date(date);
  const day = monday.getDay();
  const daysFromMonday = (day + 6) % 7;
  monday.setDate(monday.getDate() - daysFromMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const formatRangeLabel = (start: Date, end: Date) => {
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const sameYear = start.getFullYear() === end.getFullYear();

  if (sameMonth) {
    const monthYear = new Intl.DateTimeFormat(DATE_LOCALE, { month: "short", year: "numeric" }).format(start);
    return `${start.getDate()}-${end.getDate()} ${monthYear}`;
  }

  if (sameYear) {
    const startLabel = new Intl.DateTimeFormat(DATE_LOCALE, { day: "numeric", month: "short" }).format(start);
    const endLabel = new Intl.DateTimeFormat(DATE_LOCALE, { day: "numeric", month: "short", year: "numeric" }).format(end);
    return `${startLabel} - ${endLabel}`;
  }

  const fullStart = new Intl.DateTimeFormat(DATE_LOCALE, { day: "numeric", month: "short", year: "numeric" }).format(start);
  const fullEnd = new Intl.DateTimeFormat(DATE_LOCALE, { day: "numeric", month: "short", year: "numeric" }).format(end);
  return `${fullStart} - ${fullEnd}`;
};

export function PlannerPage() {
  const [calendarStart, setCalendarStart] = useState<Date>(() => startOfMonday(new Date()));
  const currentWeekStart = useMemo(() => startOfMonday(new Date()), []);
  const currentWeekEnd = useMemo(() => addDays(currentWeekStart, 6), [currentWeekStart]);

  const days = useMemo(() => {
    return Array.from({ length: 14 }, (_, index) => addDays(calendarStart, index));
  }, [calendarStart]);

  const rangeLabel = useMemo(() => {
    const rangeEnd = addDays(calendarStart, 13);
    return formatRangeLabel(calendarStart, rangeEnd);
  }, [calendarStart]);

  const goToPreviousWeek = () => setCalendarStart((current) => addDays(current, -7));
  const goToNextWeek = () => setCalendarStart((current) => addDays(current, 7));

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">📅 Meal Planner</h2>
        <p className="text-gray-600">Plan your dinners for the next 1-2 weeks</p>
      </div>

      <Card className="border-gray-100 shadow-lg">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">Week of {rangeLabel}</CardTitle>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={goToPreviousWeek}>
              ◀
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={goToNextWeek}>
              ▶
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-7 gap-3">
            {days.map((date, index) => {
              const dayName = DAY_NAMES[index % 7];
              const formattedDate = new Intl.DateTimeFormat(DATE_LOCALE, { day: "numeric", month: "short" }).format(date);
              const isCurrentWeekDay = date >= currentWeekStart && date <= currentWeekEnd;

              return (
                <Card key={date.toISOString()} className={isCurrentWeekDay ? "border-yellow-300 !bg-[#FFFACD] shadow-none overflow-hidden" : "border-gray-200 shadow-none"}>
                  <CardContent className="p-3 min-h-[130px]">
                    <div className="mb-3 border-b border-gray-100 pb-2">
                      <div className="text-xs text-gray-500 uppercase tracking-wide">{dayName}</div>
                      <div className="text-sm font-semibold text-gray-900">{formattedDate}</div>
                    </div>
                    <div className="text-xs text-gray-400">No meal planned</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
