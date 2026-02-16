import { useEffect, useMemo, useState } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { useDishes } from "../hooks/useDishes";
import { supabase } from "../lib/supabase";
import type { Dish } from "../types/dish";
import type { Database } from "../types/database";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
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
  const [mealPlansLoaded, setMealPlansLoaded] = useState(false);
  const [editingMeal, setEditingMeal] = useState<DayMealAssignment>({
    special: null,
    main: null,
    sides: [],
    dessert: null,
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

  useEffect(() => {
    if (dishesLoading || mealPlansLoaded) return;

    const loadMealPlans = async () => {
      try {
        const { data, error } = await (supabase as any).from("meal_plans").select("*");
        if (error) throw error;

        const nextAssignments: Record<string, DayMealAssignment> = {};
        ((data as MealPlanRow[]) || []).forEach((row) => {
          nextAssignments[row.date] = assignmentFromRow(row);
        });

        setAssignedMealsByDate(nextAssignments);
        setMealPlansLoaded(true);
      } catch (loadError) {
        console.error("Error loading meal plans:", loadError);
      }
    };

    loadMealPlans();
  }, [dishesLoading, mealPlansLoaded, dishes]);

  const persistMealAssignment = async (dateKey: string, meal: DayMealAssignment) => {
    const isEatingOut = meal.special?.id === "EATING_OUT";
    const isLeftovers = !isEatingOut && meal.main?.id === "LEFTOVERS";

    const payload: MealPlanInsert = {
      date: dateKey,
      main_dish_id: isEatingOut || isLeftovers || !meal.main ? null : meal.main.id,
      main_dish_type: isEatingOut ? "eating_out" : isLeftovers ? "leftovers" : meal.main ? "dish" : null,
      side_dish_ids: isEatingOut ? [] : meal.sides.map((side) => side.id),
      dessert_dish_id: isEatingOut || !meal.dessert ? null : meal.dessert.id,
    };

    const { error } = await (supabase as any).from("meal_plans").upsert(payload, { onConflict: "date" });
    if (error) throw error;
  };

  const deleteMealAssignment = async (dateKey: string) => {
    const { error } = await (supabase as any).from("meal_plans").delete().eq("date", dateKey);
    if (error) throw error;
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

    try {
      if (hasAny) {
        await persistMealAssignment(selectedDayKey, finalMeal);
        setAssignedMealsByDate((prev) => ({
          ...prev,
          [selectedDayKey]: finalMeal,
        }));
      } else {
        await deleteMealAssignment(selectedDayKey);
        setAssignedMealsByDate((prev) => {
          const next = { ...prev };
          delete next[selectedDayKey];
          return next;
        });
      }
      setMealEditorOpen(false);
    } catch (saveError) {
      console.error("Error saving meal assignment:", saveError);
    }
  };

  const clearAssignedMeal = async (date: Date) => {
    const key = toDateKey(date);

    try {
      await deleteMealAssignment(key);
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

              return (
                <Card key={date.toISOString()} className={isCurrentWeekDay ? "border-yellow-300 !bg-[#FFFACD] shadow-none overflow-hidden" : "border-gray-200 shadow-none"}>
                  <CardContent className="p-3 min-h-[130px]">
                    <div className="mb-3 border-b border-gray-100 pb-2">
                      <div className="text-xs text-gray-500 uppercase tracking-wide">{dayName}</div>
                      <div className="text-sm font-semibold text-gray-900">{formattedDate}</div>
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
                          <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => clearAssignedMeal(date)}>
                            Clear
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-xs text-gray-400">No meal planned</div>
                        <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => openMealEditorForDate(date)}>
                          + Add meal
                        </Button>
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
