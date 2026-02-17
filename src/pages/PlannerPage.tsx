import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { useDishes } from "../hooks/useDishes";
import { supabase } from "../lib/supabase";
import type { Dish } from "../types/dish";
import type { Database } from "../types/database";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const DATE_LOCALE = "en-NZ";

const SPECIAL_MEALS = [{ id: "EATING_OUT", name: "Eating Out" }] as const;
const LEFTOVERS_MAIN_OPTION: MealOption = { id: "LEFTOVERS", name: "Leftovers" };

type MealOption = {
  id: string;
  name: string;
};

type DayMealAssignment = {
  special: MealOption | null;
  main: MealOption | null;
  sides: MealOption[];
  dessert: MealOption | null;
};

type MealPlanRow = Database["public"]["Tables"]["meal_plans"]["Row"];
type MealPlanInsert = Database["public"]["Tables"]["meal_plans"]["Insert"];

type DayMetadata = {
  hasGuests: boolean;
  personAOfficeNextDay: boolean;
  personBOfficeNextDay: boolean;
};

type DefaultOfficeDays = {
  personA: string[];
  personB: string[];
};

const FALLBACK_DEFAULT_OFFICE_DAYS: DefaultOfficeDays = {
  personA: ["monday", "tuesday", "wednesday", "thursday"],
  personB: ["monday", "tuesday", "wednesday", "thursday"],
};

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

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
  const { dishes, loading: dishesLoading } = useDishes();
  const [calendarStart, setCalendarStart] = useState<Date>(() => startOfMonday(new Date()));
  const currentWeekStart = useMemo(() => startOfMonday(new Date()), []);
  const currentWeekEnd = useMemo(() => addDays(currentWeekStart, 6), [currentWeekStart]);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [mealEditorOpen, setMealEditorOpen] = useState(false);
  const [assignedMealsByDate, setAssignedMealsByDate] = useState<Record<string, DayMealAssignment>>({});
  const [lockedDaysByDate, setLockedDaysByDate] = useState<Record<string, boolean>>({});
  const [dayMetadataByDate, setDayMetadataByDate] = useState<Record<string, DayMetadata>>({});
  const [openDayMenuDateKey, setOpenDayMenuDateKey] = useState<string | null>(null);
  const openDayMenuContainerRef = useRef<HTMLDivElement | null>(null);
  const [defaultOfficeDays, setDefaultOfficeDays] = useState<DefaultOfficeDays>(FALLBACK_DEFAULT_OFFICE_DAYS);
  const [mealPlansLoaded, setMealPlansLoaded] = useState(false);
  const [editingMeal, setEditingMeal] = useState<DayMealAssignment>({
    special: null,
    main: null,
    sides: [],
    dessert: null,
  });
  const [editingDayMetadata, setEditingDayMetadata] = useState<DayMetadata>({
    hasGuests: false,
    personAOfficeNextDay: true,
    personBOfficeNextDay: true,
  });

  const days = useMemo(() => {
    return Array.from({ length: 14 }, (_, index) => addDays(calendarStart, index));
  }, [calendarStart]);

  const rangeLabel = useMemo(() => {
    const rangeEnd = addDays(calendarStart, 13);
    return formatRangeLabel(calendarStart, rangeEnd);
  }, [calendarStart]);

  const goToPreviousWeek = () => setCalendarStart((current) => addDays(current, -7));
  const goToNextWeek = () => setCalendarStart((current) => addDays(current, 7));

  const availableMainDishes = useMemo(() => {
    return dishes.filter((dish) => dish.course.includes("main") && dish.status !== "disabled");
  }, [dishes]);

  const availableSideDishes = useMemo(() => {
    return dishes.filter((dish) => dish.course.includes("side") && dish.status !== "disabled");
  }, [dishes]);

  const availableDessertDishes = useMemo(() => {
    return dishes.filter((dish) => dish.course.includes("dessert") && dish.status !== "disabled");
  }, [dishes]);

  const specialMealOptions = useMemo(() => {
    return SPECIAL_MEALS.map((meal) => ({ id: meal.id, name: meal.name }));
  }, []);

  const mainMealOptions = useMemo(() => {
    const dishOptions: MealOption[] = availableMainDishes.map((dish: Dish) => ({ id: dish.id, name: dish.name }));
    return [LEFTOVERS_MAIN_OPTION, ...dishOptions];
  }, [availableMainDishes]);

  const sideMealOptions = useMemo(() => {
    return availableSideDishes.map((dish: Dish) => ({ id: dish.id, name: dish.name }));
  }, [availableSideDishes]);

  const dessertMealOptions = useMemo(() => {
    return availableDessertDishes.map((dish: Dish) => ({ id: dish.id, name: dish.name }));
  }, [availableDessertDishes]);

  const selectedDayKey = selectedDay ? toDateKey(selectedDay) : null;
  const selectedDayLabel = selectedDay
    ? new Intl.DateTimeFormat(DATE_LOCALE, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(selectedDay)
    : "";

  const dishOptionById = (id: string | null | undefined): MealOption | null => {
    if (!id) return null;
    if (id === "LEFTOVERS") return LEFTOVERS_MAIN_OPTION;

    const match = dishes.find((dish) => dish.id === id);
    return match ? { id: match.id, name: match.name } : null;
  };

  const assignmentFromRow = (row: MealPlanRow): DayMealAssignment => {
    const isEatingOut = row.main_dish_type === "eating_out";
    const isLeftovers = row.main_dish_type === "leftovers";

    return {
      special: isEatingOut ? { id: "EATING_OUT", name: "Eating Out" } : null,
      main: isEatingOut ? null : isLeftovers ? LEFTOVERS_MAIN_OPTION : dishOptionById(row.main_dish_id),
      sides: (row.side_dish_ids || []).map((id) => dishOptionById(id)).filter((meal): meal is MealOption => meal !== null),
      dessert: isEatingOut ? null : dishOptionById(row.dessert_dish_id),
    };
  };

  const hasAnyAssignedMeal = (meal: DayMealAssignment | undefined) => {
    if (!meal) return false;
    return meal.special !== null || meal.main !== null || meal.sides.length > 0 || meal.dessert !== null;
  };

  const normalizeOfficeDays = (input: unknown): DefaultOfficeDays => {
    const payload = (input as { personA?: unknown; personB?: unknown } | null) || null;
    const normalizeList = (value: unknown, fallback: string[]) => {
      if (!Array.isArray(value)) return fallback;
      const normalized = value
        .map((entry) => (typeof entry === "string" ? entry.toLowerCase() : ""))
        .filter((entry) => WEEKDAY_KEYS.includes(entry as (typeof WEEKDAY_KEYS)[number]));
      return normalized.length > 0 ? normalized : fallback;
    };

    return {
      personA: normalizeList(payload?.personA, FALLBACK_DEFAULT_OFFICE_DAYS.personA),
      personB: normalizeList(payload?.personB, FALLBACK_DEFAULT_OFFICE_DAYS.personB),
    };
  };

  const weekdayKeyFromDate = (date: Date) => {
    const weekdayIndex = (date.getDay() + 6) % 7;
    return WEEKDAY_KEYS[weekdayIndex];
  };

  const defaultMetadataForDate = (date: Date): DayMetadata => {
    const weekdayKey = weekdayKeyFromDate(date);
    return {
      hasGuests: false,
      personAOfficeNextDay: defaultOfficeDays.personA.includes(weekdayKey),
      personBOfficeNextDay: defaultOfficeDays.personB.includes(weekdayKey),
    };
  };

  const resolvedMetadataForDateKey = (dateKey: string): DayMetadata => {
    const fromState = dayMetadataByDate[dateKey];
    if (fromState) return fromState;

    const [year, month, day] = dateKey.split("-").map(Number);
    const date = new Date(year, (month || 1) - 1, day || 1);
    return defaultMetadataForDate(date);
  };

  const hasMetadataOverride = (dateKey: string, metadata: DayMetadata) => {
    const [year, month, day] = dateKey.split("-").map(Number);
    const date = new Date(year, (month || 1) - 1, day || 1);
    const defaults = defaultMetadataForDate(date);
    return (
      metadata.hasGuests !== defaults.hasGuests ||
      metadata.personAOfficeNextDay !== defaults.personAOfficeNextDay ||
      metadata.personBOfficeNextDay !== defaults.personBOfficeNextDay
    );
  };

  useEffect(() => {
    if (dishesLoading || mealPlansLoaded) return;

    const loadMealPlans = async () => {
      try {
        const [{ data: settingsData, error: settingsError }, { data, error }] = await Promise.all([
          (supabase as any).from("user_settings").select("default_office_days").limit(1).maybeSingle(),
          (supabase as any).from("meal_plans").select("*"),
        ]);

        if (settingsError) throw settingsError;
        if (error) throw error;

        setDefaultOfficeDays(normalizeOfficeDays(settingsData?.default_office_days));

        const nextAssignments: Record<string, DayMealAssignment> = {};
        const nextLockedDays: Record<string, boolean> = {};
        const nextDayMetadata: Record<string, DayMetadata> = {};
        ((data as MealPlanRow[]) || []).forEach((row) => {
          const assignment = assignmentFromRow(row);
          if (hasAnyAssignedMeal(assignment)) {
            nextAssignments[row.date] = assignment;
          }
          nextLockedDays[row.date] = Boolean(row.locked);
          nextDayMetadata[row.date] = {
            hasGuests: Boolean(row.has_guests),
            personAOfficeNextDay: Boolean(row.person_a_office_next_day),
            personBOfficeNextDay: Boolean(row.person_b_office_next_day),
          };
        });

        setAssignedMealsByDate(nextAssignments);
        setLockedDaysByDate(nextLockedDays);
        setDayMetadataByDate(nextDayMetadata);
        setMealPlansLoaded(true);
      } catch (loadError) {
        console.error("Error loading meal plans:", loadError);
      }
    };

    loadMealPlans();
  }, [dishesLoading, mealPlansLoaded, dishes]);

  useEffect(() => {
    if (!openDayMenuDateKey) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!openDayMenuContainerRef.current) return;
      if (openDayMenuContainerRef.current.contains(event.target as Node)) return;
      setOpenDayMenuDateKey(null);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [openDayMenuDateKey]);

  const persistMealAssignment = async (dateKey: string, meal: DayMealAssignment, metadata: DayMetadata) => {
    const isEatingOut = meal.special?.id === "EATING_OUT";
    const isLeftovers = !isEatingOut && meal.main?.id === "LEFTOVERS";
    const isLocked = Boolean(lockedDaysByDate[dateKey]);

    const payload: MealPlanInsert = {
      date: dateKey,
      main_dish_id: isEatingOut || isLeftovers || !meal.main ? null : meal.main.id,
      main_dish_type: isEatingOut ? "eating_out" : isLeftovers ? "leftovers" : meal.main ? "dish" : null,
      side_dish_ids: isEatingOut ? [] : meal.sides.map((side) => side.id),
      dessert_dish_id: isEatingOut || !meal.dessert ? null : meal.dessert.id,
      has_guests: metadata.hasGuests,
      person_a_office_next_day: metadata.personAOfficeNextDay,
      person_b_office_next_day: metadata.personBOfficeNextDay,
      locked: isLocked,
    };

    const { error } = await (supabase as any).from("meal_plans").upsert(payload, { onConflict: "date" });
    if (error) throw error;
  };

  const deleteMealAssignment = async (dateKey: string) => {
    const { error } = await (supabase as any).from("meal_plans").delete().eq("date", dateKey);
    if (error) throw error;
  };

  const persistDayLock = async (dateKey: string, isLocked: boolean) => {
    const metadata = resolvedMetadataForDateKey(dateKey);

    if (isLocked) {
      const payload: MealPlanInsert = {
        date: dateKey,
        has_guests: metadata.hasGuests,
        person_a_office_next_day: metadata.personAOfficeNextDay,
        person_b_office_next_day: metadata.personBOfficeNextDay,
        locked: true,
      };
      const { error } = await (supabase as any).from("meal_plans").upsert(payload, { onConflict: "date" });
      if (error) throw error;
      return;
    }

    const assignedMeal = assignedMealsByDate[dateKey];
    const shouldKeepMetadataRow = hasMetadataOverride(dateKey, metadata);
    if (!hasAnyAssignedMeal(assignedMeal) && !shouldKeepMetadataRow) {
      await deleteMealAssignment(dateKey);
      return;
    }

    const payload: MealPlanInsert = {
      date: dateKey,
      has_guests: metadata.hasGuests,
      person_a_office_next_day: metadata.personAOfficeNextDay,
      person_b_office_next_day: metadata.personBOfficeNextDay,
      locked: false,
    };
    const { error } = await (supabase as any).from("meal_plans").upsert(payload, { onConflict: "date" });
    if (error) throw error;
  };

  const toggleDayLock = async (date: Date) => {
    const dateKey = toDateKey(date);
    const nextLockValue = !Boolean(lockedDaysByDate[dateKey]);

    try {
      await persistDayLock(dateKey, nextLockValue);
      setLockedDaysByDate((prev) => ({
        ...prev,
        [dateKey]: nextLockValue,
      }));
    } catch (lockError) {
      console.error("Error updating day lock:", lockError);
    }
  };

  const persistDayMetadata = async (dateKey: string, metadata: DayMetadata) => {
    const assignedMeal = assignedMealsByDate[dateKey];
    const isLocked = Boolean(lockedDaysByDate[dateKey]);
    const shouldKeepMetadataRow = hasMetadataOverride(dateKey, metadata);

    if (!hasAnyAssignedMeal(assignedMeal) && !isLocked && !shouldKeepMetadataRow) {
      await deleteMealAssignment(dateKey);
      return;
    }

    const payload: MealPlanInsert = {
      date: dateKey,
      has_guests: metadata.hasGuests,
      person_a_office_next_day: metadata.personAOfficeNextDay,
      person_b_office_next_day: metadata.personBOfficeNextDay,
      locked: isLocked,
    };

    const { error } = await (supabase as any).from("meal_plans").upsert(payload, { onConflict: "date" });
    if (error) throw error;
  };

  const toggleGuestsForDate = async (date: Date) => {
    const dateKey = toDateKey(date);
    const current = resolvedMetadataForDateKey(dateKey);
    const next: DayMetadata = {
      ...current,
      hasGuests: !current.hasGuests,
    };

    try {
      await persistDayMetadata(dateKey, next);
      setDayMetadataByDate((prev) => {
        const shouldKeep = hasMetadataOverride(dateKey, next);
        if (!shouldKeep) {
          const stateWithoutDate = { ...prev };
          delete stateWithoutDate[dateKey];
          return stateWithoutDate;
        }

        return {
          ...prev,
          [dateKey]: next,
        };
      });
    } catch (metadataError) {
      console.error("Error updating guests for day:", metadataError);
    }
  };

  const toggleOfficeForDate = async (date: Date, person: "A" | "B") => {
    const dateKey = toDateKey(date);
    const current = resolvedMetadataForDateKey(dateKey);
    const next: DayMetadata =
      person === "A"
        ? {
            ...current,
            personAOfficeNextDay: !current.personAOfficeNextDay,
          }
        : {
            ...current,
            personBOfficeNextDay: !current.personBOfficeNextDay,
          };

    try {
      await persistDayMetadata(dateKey, next);
      setDayMetadataByDate((prev) => {
        const shouldKeep = hasMetadataOverride(dateKey, next);
        if (!shouldKeep) {
          const stateWithoutDate = { ...prev };
          delete stateWithoutDate[dateKey];
          return stateWithoutDate;
        }

        return {
          ...prev,
          [dateKey]: next,
        };
      });
    } catch (metadataError) {
      console.error("Error updating office day:", metadataError);
    }
  };

  const openMealEditorForDate = (date: Date) => {
    const key = toDateKey(date);
    const existing = assignedMealsByDate[key];
    const specialMealIds: Set<string> = new Set(SPECIAL_MEALS.map((meal) => meal.id));

    const migratedExisting = existing
      ? {
          ...existing,
          special: existing.special || (existing.main && specialMealIds.has(existing.main.id) ? existing.main : null),
          main: existing.main && specialMealIds.has(existing.main.id) ? null : existing.main,
        }
      : null;

    setEditingMeal(
      migratedExisting || {
        special: null,
        main: null,
        sides: [],
        dessert: null,
      }
    );

    setEditingDayMetadata(resolvedMetadataForDateKey(key));
    setOpenDayMenuDateKey(null);

    setSelectedDay(date);
    setMealEditorOpen(true);
  };

  const saveMealAssignment = async () => {
    if (!selectedDayKey) return;

    const finalMeal: DayMealAssignment = editingMeal.special
      ? {
          special: editingMeal.special,
          main: null,
          sides: [],
          dessert: null,
        }
      : editingMeal;

    const hasAny = finalMeal.special || finalMeal.main || finalMeal.sides.length > 0 || finalMeal.dessert;
    const shouldKeepMetadataRow = hasMetadataOverride(selectedDayKey, editingDayMetadata);
    const isLocked = Boolean(lockedDaysByDate[selectedDayKey]);

    try {
      if (hasAny) {
        await persistMealAssignment(selectedDayKey, finalMeal, editingDayMetadata);
        setAssignedMealsByDate((prev) => ({
          ...prev,
          [selectedDayKey]: finalMeal,
        }));
        setDayMetadataByDate((prev) => ({
          ...prev,
          [selectedDayKey]: editingDayMetadata,
        }));
      } else {
        if (isLocked || shouldKeepMetadataRow) {
          const payload: MealPlanInsert = {
            date: selectedDayKey,
            main_dish_id: null,
            main_dish_type: null,
            side_dish_ids: [],
            dessert_dish_id: null,
            has_guests: editingDayMetadata.hasGuests,
            person_a_office_next_day: editingDayMetadata.personAOfficeNextDay,
            person_b_office_next_day: editingDayMetadata.personBOfficeNextDay,
            locked: isLocked,
          };
          const { error } = await (supabase as any).from("meal_plans").upsert(payload, { onConflict: "date" });
          if (error) throw error;
        } else {
          await deleteMealAssignment(selectedDayKey);
        }

        setAssignedMealsByDate((prev) => {
          const next = { ...prev };
          delete next[selectedDayKey];
          return next;
        });

        setDayMetadataByDate((prev) => {
          if (!shouldKeepMetadataRow) {
            const next = { ...prev };
            delete next[selectedDayKey];
            return next;
          }

          return {
            ...prev,
            [selectedDayKey]: editingDayMetadata,
          };
        });
      }
      setMealEditorOpen(false);
    } catch (saveError) {
      console.error("Error saving meal assignment:", saveError);
    }
  };

  const clearAssignedMeal = async (date: Date) => {
    const key = toDateKey(date);
    const isLocked = Boolean(lockedDaysByDate[key]);
    const metadata = resolvedMetadataForDateKey(key);
    const shouldKeepMetadataRow = hasMetadataOverride(key, metadata);

    try {
      if (isLocked) {
        const payload: MealPlanInsert = {
          date: key,
          main_dish_id: null,
          main_dish_type: null,
          side_dish_ids: [],
          dessert_dish_id: null,
          has_guests: metadata.hasGuests,
          person_a_office_next_day: metadata.personAOfficeNextDay,
          person_b_office_next_day: metadata.personBOfficeNextDay,
          locked: true,
        };
        const { error } = await (supabase as any).from("meal_plans").upsert(payload, { onConflict: "date" });
        if (error) throw error;
      } else if (shouldKeepMetadataRow) {
        const payload: MealPlanInsert = {
          date: key,
          main_dish_id: null,
          main_dish_type: null,
          side_dish_ids: [],
          dessert_dish_id: null,
          has_guests: metadata.hasGuests,
          person_a_office_next_day: metadata.personAOfficeNextDay,
          person_b_office_next_day: metadata.personBOfficeNextDay,
          locked: false,
        };
        const { error } = await (supabase as any).from("meal_plans").upsert(payload, { onConflict: "date" });
        if (error) throw error;
      } else {
        await deleteMealAssignment(key);
      }

      setAssignedMealsByDate((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } catch (clearError) {
      console.error("Error clearing meal assignment:", clearError);
    }
  };

  const setMainMeal = (meal: MealOption) => {
    setEditingMeal((prev) => ({
      ...prev,
      special: null,
      main: meal,
    }));
  };

  const toggleSideMeal = (meal: MealOption) => {
    setEditingMeal((prev) => {
      if (prev.special) {
        return prev;
      }

      const alreadySelected = prev.sides.some((side) => side.id === meal.id);
      return {
        ...prev,
        sides: alreadySelected ? prev.sides.filter((side) => side.id !== meal.id) : [...prev.sides, meal],
      };
    });
  };

  const setDessertMeal = (meal: MealOption | null) => {
    setEditingMeal((prev) => ({
      ...prev,
      special: null,
      dessert: meal,
    }));
  };

  const setSpecialMeal = (meal: MealOption | null) => {
    setEditingMeal((prev) => ({
      ...prev,
      special: meal,
      ...(meal
        ? {
            main: null,
            sides: [],
            dessert: null,
          }
        : {}),
    }));
  };

  const toggleEatingOut = () => {
    const eatingOutOption = specialMealOptions[0] || null;
    const isEnabled = editingMeal.special?.id === "EATING_OUT";
    setSpecialMeal(isEnabled ? null : eatingOutOption);
  };

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
              const dateKey = toDateKey(date);
              const assignedMeal = assignedMealsByDate[dateKey];
              const isLocked = Boolean(lockedDaysByDate[dateKey]);
              const dayMetadata = resolvedMetadataForDateKey(dateKey);
              const isDayMenuOpen = openDayMenuDateKey === dateKey;

              return (
                <Card key={date.toISOString()} className={isCurrentWeekDay ? "border-yellow-300 !bg-[#FFFACD] shadow-none" : "border-gray-200 shadow-none"}>
                  <CardContent className="p-3 min-h-[130px]">
                    <div className="mb-3 border-b border-gray-100 pb-2 flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs text-gray-500 uppercase tracking-wide">{dayName}</div>
                        <div className="text-sm font-semibold text-gray-900">{formattedDate}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant={isLocked ? "default" : "outline"}
                          className="h-6 px-2 text-xs"
                          onClick={() => toggleDayLock(date)}
                          aria-label={isLocked ? `Unlock ${dayName} ${formattedDate}` : `Lock ${dayName} ${formattedDate}`}
                          title="Locks this day for auto-suggest only. Manual changes are still allowed."
                        >
                          {isLocked ? "🔒" : "🔓"}
                        </Button>

                        <div className="relative" ref={isDayMenuOpen ? openDayMenuContainerRef : undefined}>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-6 w-6 p-0 text-xs"
                            onClick={() => setOpenDayMenuDateKey((current) => (current === dateKey ? null : dateKey))}
                            aria-label={`Open actions for ${dayName} ${formattedDate}`}
                            title="Day actions"
                          >
                            ⋯
                          </Button>

                          {isDayMenuOpen && (
                            <div className="absolute right-0 z-20 mt-1 w-[14rem] rounded-md border border-gray-200 bg-white p-1 shadow-md">
                              <button
                                type="button"
                                className="w-full rounded px-2 py-1 text-left text-xs text-gray-700 hover:bg-gray-100"
                                onClick={async () => {
                                  await toggleGuestsForDate(date);
                                  setOpenDayMenuDateKey(null);
                                }}
                              >
                                {dayMetadata.hasGuests ? "✓ " : ""}Guests coming
                              </button>
                              <button
                                type="button"
                                className="w-full rounded px-2 py-1 text-left text-xs text-gray-700 hover:bg-gray-100"
                                onClick={async () => {
                                  await toggleOfficeForDate(date, "A");
                                  setOpenDayMenuDateKey(null);
                                }}
                              >
                                {dayMetadata.personAOfficeNextDay ? "✓ " : ""}Person A office next day
                              </button>
                              <button
                                type="button"
                                className="w-full rounded px-2 py-1 text-left text-xs text-gray-700 hover:bg-gray-100"
                                onClick={async () => {
                                  await toggleOfficeForDate(date, "B");
                                  setOpenDayMenuDateKey(null);
                                }}
                              >
                                {dayMetadata.personBOfficeNextDay ? "✓ " : ""}Person B office next day
                              </button>
                              <div className="my-1 border-t border-gray-200" />
                              <button
                                type="button"
                                className="w-full rounded px-2 py-1 text-left text-xs text-red-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300"
                                disabled={!assignedMeal}
                                onClick={async () => {
                                  await clearAssignedMeal(date);
                                  setOpenDayMenuDateKey(null);
                                }}
                              >
                                Clear meal
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {assignedMeal ? (
                      <div className="space-y-2">
                        {assignedMeal.special ? (
                          <div className="text-sm text-gray-900 font-medium">Special: {assignedMeal.special.name}</div>
                        ) : (
                          <>
                            {assignedMeal.main && <div className="text-sm text-gray-900 font-medium">Main: {assignedMeal.main.name}</div>}
                            {assignedMeal.sides.length > 0 && <div className="text-xs text-gray-700">Sides: {assignedMeal.sides.map((side) => side.name).join(", ")}</div>}
                            {assignedMeal.dessert && <div className="text-xs text-gray-700">Dessert: {assignedMeal.dessert.name}</div>}
                          </>
                        )}
                        <div className="flex gap-2">
                          <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => openMealEditorForDate(date)}>
                            Change
                          </Button>
                        </div>
                        {(dayMetadata.hasGuests || dayMetadata.personAOfficeNextDay || dayMetadata.personBOfficeNextDay) && (
                          <div className="text-[11px] text-gray-600 flex flex-wrap gap-2">
                            {dayMetadata.personAOfficeNextDay && <span>🏢A</span>}
                            {dayMetadata.personBOfficeNextDay && <span>🏢B</span>}
                            {dayMetadata.hasGuests && <span>👥</span>}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-xs text-gray-400">No meal planned</div>
                        <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => openMealEditorForDate(date)}>
                          + Add meal
                        </Button>
                        {(dayMetadata.hasGuests || dayMetadata.personAOfficeNextDay || dayMetadata.personBOfficeNextDay) && (
                          <div className="text-[11px] text-gray-600 flex flex-wrap gap-2">
                            {dayMetadata.personAOfficeNextDay && <span>🏢A</span>}
                            {dayMetadata.personBOfficeNextDay && <span>🏢B</span>}
                            {dayMetadata.hasGuests && <span>👥</span>}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={mealEditorOpen} onOpenChange={setMealEditorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit meal for {selectedDayLabel}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
            {dishesLoading ? (
              <div className="text-sm text-gray-500">Loading dishes...</div>
            ) : (
              <>
                <Button
                  type="button"
                  variant={editingMeal.special?.id === "EATING_OUT" ? "default" : "outline"}
                  className="w-full justify-start"
                  onClick={toggleEatingOut}
                >
                  Eating Out
                </Button>

                <div className="space-y-2">
                  <div className="text-sm font-medium text-gray-900">Main</div>
                  {mainMealOptions.length === 0 ? (
                    <div className="text-sm text-gray-500">No available main dishes yet.</div>
                  ) : (
                    <div className="grid gap-2">
                      {mainMealOptions.map((meal) => {
                        const isSelected = editingMeal.main?.id === meal.id;
                        return (
                          <Button
                            key={meal.id}
                            type="button"
                            variant={isSelected ? "default" : "outline"}
                            className="w-full justify-start"
                            disabled={editingMeal.special !== null}
                            onClick={() => setMainMeal(meal)}
                          >
                            {meal.name}
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium text-gray-900">Sides (select multiple)</div>
                  {sideMealOptions.length === 0 ? (
                    <div className="text-sm text-gray-500">No side dishes available.</div>
                  ) : (
                    <div className="grid gap-2">
                      {sideMealOptions.map((meal) => {
                        const isSelected = editingMeal.sides.some((side) => side.id === meal.id);
                        return (
                          <Button
                            key={meal.id}
                            type="button"
                            variant={isSelected ? "default" : "outline"}
                            className="w-full justify-start"
                            disabled={editingMeal.special !== null}
                            onClick={() => toggleSideMeal(meal)}
                          >
                            {meal.name}
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium text-gray-900">Dessert (optional)</div>
                  <Button
                    type="button"
                    variant={editingMeal.dessert === null ? "default" : "outline"}
                    className="w-full justify-start"
                    disabled={editingMeal.special !== null}
                    onClick={() => setDessertMeal(null)}
                  >
                    No dessert
                  </Button>
                  {dessertMealOptions.length === 0 ? (
                    <div className="text-sm text-gray-500">No dessert dishes available.</div>
                  ) : (
                    <div className="grid gap-2">
                      {dessertMealOptions.map((meal) => {
                        const isSelected = editingMeal.dessert?.id === meal.id;
                        return (
                          <Button
                            key={meal.id}
                            type="button"
                            variant={isSelected ? "default" : "outline"}
                            className="w-full justify-start"
                            disabled={editingMeal.special !== null}
                            onClick={() => setDessertMeal(meal)}
                          >
                            {meal.name}
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="space-y-3 border-t border-gray-100 pt-3">
                  <div className="text-sm font-medium text-gray-900">Day details</div>

                  <label className="inline-flex items-center text-sm gap-2">
                    <Checkbox
                      checked={editingDayMetadata.hasGuests}
                      onCheckedChange={(checked) => setEditingDayMetadata((prev) => ({ ...prev, hasGuests: checked === true }))}
                    />
                    Guests coming
                  </label>

                  <div className="text-sm font-medium text-gray-900">Office next day</div>
                  <div className="flex gap-4">
                    <label className="inline-flex items-center text-sm gap-2">
                      <Checkbox
                        checked={editingDayMetadata.personAOfficeNextDay}
                        onCheckedChange={(checked) => setEditingDayMetadata((prev) => ({ ...prev, personAOfficeNextDay: checked === true }))}
                      />
                      Person A
                    </label>
                    <label className="inline-flex items-center text-sm gap-2">
                      <Checkbox
                        checked={editingDayMetadata.personBOfficeNextDay}
                        onCheckedChange={(checked) => setEditingDayMetadata((prev) => ({ ...prev, personBOfficeNextDay: checked === true }))}
                      />
                      Person B
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setMealEditorOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={saveMealAssignment}>
                    Save meal
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
