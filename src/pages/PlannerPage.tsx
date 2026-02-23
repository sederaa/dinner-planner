import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { useDishes } from "../hooks/useDishes";
import { supabase } from "../lib/supabase";
import type { Dish } from "../types/dish";
import type { Database } from "../types/database";
import { DEFAULT_RULES, type Rule, type RuleType } from "../types/rule";
import { rankDishesForDay, scoreDishForDay, type AppliedRuleResult } from "../utils/scoringEngine";

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

type RuleConfigRow = {
  id: string;
  name: string;
  enabled: boolean;
  rule_type: RuleType;
  parameters: Record<string, unknown>;
  points: number | null;
};

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
  const [configuredRules, setConfiguredRules] = useState<Rule[]>(DEFAULT_RULES);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [autoSuggestMessage, setAutoSuggestMessage] = useState<string | null>(null);
  const [selectedDaysByDate, setSelectedDaysByDate] = useState<Record<string, boolean>>({});
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

  const autoSuggestableMainDishes = useMemo(() => {
    return availableMainDishes.filter((dish) => dish.status === "enabled" && dish.type !== "leftovers" && dish.type !== "eating_out");
  }, [availableMainDishes]);

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
  const selectedDateKeys = useMemo(() => {
    return days.map((date) => toDateKey(date)).filter((dateKey) => Boolean(selectedDaysByDate[dateKey]));
  }, [days, selectedDaysByDate]);
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

  const mergeRulesFromConfigRows = (rows: RuleConfigRow[]): Rule[] => {
    const byType = rows.reduce<Partial<Record<RuleType, RuleConfigRow>>>((acc, row) => {
      if (!acc[row.rule_type]) {
        acc[row.rule_type] = row;
      }
      return acc;
    }, {});

    return DEFAULT_RULES.map((defaultRule) => {
      const row = byType[defaultRule.type];
      if (!row) return defaultRule;

      if (defaultRule.type === "no_consecutive_same_protein") {
        const value = Number(row.parameters?.maxConsecutiveDays);
        return {
          ...defaultRule,
          id: row.id,
          name: row.name,
          enabled: row.enabled,
          points: row.points ?? defaultRule.points,
          maxConsecutiveDays: Number.isFinite(value) ? Math.max(1, value) : defaultRule.maxConsecutiveDays,
        };
      }

      if (defaultRule.type === "prioritize_ingredient") {
        const ingredient = typeof row.parameters?.ingredient === "string" ? row.parameters.ingredient : defaultRule.ingredient;
        return {
          ...defaultRule,
          id: row.id,
          name: row.name,
          enabled: row.enabled,
          points: row.points ?? defaultRule.points,
          ingredient,
        };
      }

      if (defaultRule.type === "dish_cooldown_period") {
        const value = Number(row.parameters?.cooldownDays);
        return {
          ...defaultRule,
          id: row.id,
          name: row.name,
          enabled: row.enabled,
          points: row.points ?? defaultRule.points,
          cooldownDays: Number.isFinite(value) ? Math.max(1, value) : defaultRule.cooldownDays,
        };
      }

      return {
        ...defaultRule,
        id: row.id,
        name: row.name,
        enabled: row.enabled,
        points: row.points ?? defaultRule.points,
      };
    });
  };

  const mealAssignmentToDish = (assignment: DayMealAssignment): Dish | null => {
    if (assignment.special?.id === "EATING_OUT") {
      return {
        id: "EATING_OUT",
        name: "Eating Out",
        course: ["main"],
        proteins: [],
        isSpicy: false,
        time: "low",
        keyIngredients: [],
        status: "manual_only",
        type: "eating_out",
      };
    }

    if (assignment.main?.id === "LEFTOVERS") {
      return {
        id: "LEFTOVERS",
        name: "Leftovers",
        course: ["main"],
        proteins: [],
        isSpicy: false,
        time: "low",
        keyIngredients: [],
        status: "manual_only",
        type: "leftovers",
      };
    }

    if (!assignment.main?.id) return null;
    return dishes.find((dish) => dish.id === assignment.main?.id) || null;
  };

  const getPreviousDishesForDateKey = (dateKey: string, assignmentOverrides: Record<string, DayMealAssignment> = {}) => {
    return Object.keys({ ...assignedMealsByDate, ...assignmentOverrides })
      .filter((key) => key < dateKey)
      .sort((left, right) => right.localeCompare(left))
      .map((key) => assignmentOverrides[key] || assignedMealsByDate[key])
      .map((assignment) => (assignment ? mealAssignmentToDish(assignment) : null))
      .filter((dish): dish is Dish => dish !== null);
  };

  const getRuleViolationsForMeal = (dateKey: string, assignment: DayMealAssignment | undefined, metadata: DayMetadata): AppliedRuleResult[] => {
    if (!assignment) return [];

    const dish = mealAssignmentToDish(assignment);
    if (!dish) return [];

    const scoringResult = scoreDishForDay({
      dish,
      dayContext: {
        hasGuests: metadata.hasGuests,
        personAOfficeNextDay: metadata.personAOfficeNextDay,
        personBOfficeNextDay: metadata.personBOfficeNextDay,
      },
      rules: configuredRules,
      previousDishes: getPreviousDishesForDateKey(dateKey),
    });

    return scoringResult.appliedRules.filter((ruleResult) => ruleResult.violated);
  };

  const getViolationLabel = (violation: AppliedRuleResult) => {
    const matchingRule = configuredRules.find((rule) => rule.type === violation.ruleType);
    return matchingRule?.name || violation.reason;
  };

  useEffect(() => {
    if (dishesLoading || mealPlansLoaded) return;

    const loadMealPlans = async () => {
      try {
        const [{ data: settingsData, error: settingsError }, { data, error }, { data: rulesData, error: rulesError }] = await Promise.all([
          (supabase as any).from("user_settings").select("default_office_days").limit(1).maybeSingle(),
          (supabase as any).from("meal_plans").select("*"),
          (supabase as any).from("rules_config").select("*"),
        ]);

        if (settingsError) throw settingsError;
        if (error) throw error;

        setDefaultOfficeDays(normalizeOfficeDays(settingsData?.default_office_days));

        if (!rulesError && rulesData) {
          setConfiguredRules(mergeRulesFromConfigRows((rulesData as RuleConfigRow[]) || []));
        }

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

      if (nextLockValue) {
        setSelectedDaysByDate((prev) => {
          if (!prev[dateKey]) return prev;
          const next = { ...prev };
          delete next[dateKey];
          return next;
        });
      }
    } catch (lockError) {
      console.error("Error updating day lock:", lockError);
    }
  };

  const setAutoSuggestFeedback = (message: string) => {
    setAutoSuggestMessage(message);
    setTimeout(() => {
      setAutoSuggestMessage(null);
    }, 2500);
  };

  const chooseSuggestedMainForDate = (dateKey: string, assignmentOverrides: Record<string, DayMealAssignment> = {}): MealOption | null => {
    if (autoSuggestableMainDishes.length === 0) return null;

    const metadata = resolvedMetadataForDateKey(dateKey);
    const ranked = rankDishesForDay({
      dishes: autoSuggestableMainDishes,
      dayContext: {
        hasGuests: metadata.hasGuests,
        personAOfficeNextDay: metadata.personAOfficeNextDay,
        personBOfficeNextDay: metadata.personBOfficeNextDay,
      },
      rules: configuredRules,
      previousDishes: getPreviousDishesForDateKey(dateKey, assignmentOverrides),
    });

    const best = ranked[0]?.dish;
    return best ? { id: best.id, name: best.name } : null;
  };

  const buildRuleSummary = (appliedRules: AppliedRuleResult[]) => {
    if (appliedRules.length === 0) return "No active rule impacts";

    return appliedRules
      .map((rule) => {
        const matchingRule = configuredRules.find((configuredRule) => configuredRule.type === rule.ruleType);
        const ruleLabel = matchingRule?.name || rule.ruleType;
        const deltaLabel = rule.delta > 0 ? `+${rule.delta}` : `${rule.delta}`;
        const stateLabel = rule.violated ? "violated" : "ok";
        return `${ruleLabel}: ${deltaLabel} (${stateLabel})`;
      })
      .join("\n");
  };

  const getMealDebugTitle = (dateKey: string, assignment: DayMealAssignment | undefined) => {
    if (!assignment) return "No meal planned";

    if (assignment.special?.id === "EATING_OUT") {
      return "Special meal: Eating Out (never auto-suggested)";
    }

    if (assignment.main?.id === "LEFTOVERS") {
      return "Special meal: Leftovers (manual-only, never auto-suggested)";
    }

    if (!assignment.main) {
      return "No main dish selected";
    }

    const metadata = resolvedMetadataForDateKey(dateKey);
    const previousDishes = getPreviousDishesForDateKey(dateKey);
    const ranked = rankDishesForDay({
      dishes: autoSuggestableMainDishes,
      dayContext: {
        hasGuests: metadata.hasGuests,
        personAOfficeNextDay: metadata.personAOfficeNextDay,
        personBOfficeNextDay: metadata.personBOfficeNextDay,
      },
      rules: configuredRules,
      previousDishes,
    });

    const selected = ranked.find((entry) => entry.dish.id === assignment.main?.id);
    if (!selected) {
      return `${assignment.main.name}\nManual or non-auto-suggestable main dish`;
    }

    const rank = ranked.findIndex((entry) => entry.dish.id === assignment.main?.id) + 1;
    const best = ranked[0];
    const topAlternatives = ranked
      .slice(0, 3)
      .map((entry, index) => `${index + 1}. ${entry.dish.name} (${entry.score})`)
      .join("\n");

    const lines: string[] = [
      `Suggested score debug for ${assignment.main.name}`,
      `Score: ${selected.score}`,
      `Rank: ${rank}/${ranked.length}`,
      `Best candidate: ${best?.dish.name || assignment.main.name} (${best?.score ?? selected.score})`,
      "",
      "Rule impacts:",
      buildRuleSummary(selected.appliedRules),
      "",
      "Top options:",
      topAlternatives,
    ];

    return lines.join("\n");
  };

  const autoSuggestForDateKeys = async (requestedDateKeys: string[]) => {
    const uniqueDateKeys = Array.from(new Set(requestedDateKeys));
    const unlockedDateKeys = uniqueDateKeys.filter((dateKey) => !lockedDaysByDate[dateKey]);

    if (unlockedDateKeys.length === 0) {
      setAutoSuggestFeedback("No unlocked days to suggest");
      return;
    }

    if (autoSuggestableMainDishes.length === 0) {
      setAutoSuggestFeedback("No enabled main dishes available");
      return;
    }

    const suggestions: Record<string, DayMealAssignment> = {};
    const operations: Promise<void>[] = [];

    const orderedDateKeys = [...unlockedDateKeys].sort((left, right) => left.localeCompare(right));
    orderedDateKeys.forEach((dateKey) => {
      const suggestedMain = chooseSuggestedMainForDate(dateKey, suggestions);
      if (!suggestedMain) return;

      const suggestedMeal: DayMealAssignment = {
        special: null,
        main: suggestedMain,
        sides: [],
        dessert: null,
      };

      suggestions[dateKey] = suggestedMeal;
      operations.push(persistMealAssignment(dateKey, suggestedMeal, resolvedMetadataForDateKey(dateKey)));
    });

    if (operations.length === 0) {
      setAutoSuggestFeedback("No suggestions generated");
      return;
    }

    try {
      await Promise.all(operations);
      setAssignedMealsByDate((prev) => ({
        ...prev,
        ...suggestions,
      }));
      setAutoSuggestFeedback(`Suggested meals for ${operations.length} day${operations.length === 1 ? "" : "s"}`);
    } catch (suggestError) {
      console.error("Error auto-suggesting meals:", suggestError);
      setAutoSuggestFeedback("Auto-suggest failed");
    }
  };

  const autoSuggestAllDays = async () => {
    await autoSuggestForDateKeys(days.map((date) => toDateKey(date)));
  };

  const autoSuggestSelectedDays = async () => {
    await autoSuggestForDateKeys(selectedDateKeys);
    setSelectedDaysByDate({});
  };

  const toggleDaySelection = (dateKey: string, checked: boolean) => {
    setSelectedDaysByDate((prev) => {
      if (checked) {
        return {
          ...prev,
          [dateKey]: true,
        };
      }

      if (!prev[dateKey]) return prev;
      const next = { ...prev };
      delete next[dateKey];
      return next;
    });
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

  const clearMealForDateKey = async (dateKey: string) => {
    const isLocked = Boolean(lockedDaysByDate[dateKey]);
    const metadata = resolvedMetadataForDateKey(dateKey);
    const shouldKeepMetadataRow = hasMetadataOverride(dateKey, metadata);

    if (isLocked) {
      const payload: MealPlanInsert = {
        date: dateKey,
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
      return;
    }

    if (shouldKeepMetadataRow) {
      const payload: MealPlanInsert = {
        date: dateKey,
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
      return;
    }

    await deleteMealAssignment(dateKey);
  };

  const clearMealsByMode = async (mode: "all" | "non-locked") => {
    const dateKeysInView = days.map((date) => toDateKey(date));
    const plannedDateKeys = dateKeysInView.filter((dateKey) => hasAnyAssignedMeal(assignedMealsByDate[dateKey]));
    const dateKeysToClear = plannedDateKeys.filter((dateKey) => mode === "all" || !lockedDaysByDate[dateKey]);

    if (dateKeysToClear.length === 0) {
      setAutoSuggestFeedback(mode === "all" ? "No planned meals to clear" : "No non-locked planned meals to clear");
      return;
    }

    try {
      await Promise.all(dateKeysToClear.map((dateKey) => clearMealForDateKey(dateKey)));
      setAssignedMealsByDate((prev) => {
        const next = { ...prev };
        dateKeysToClear.forEach((dateKey) => {
          delete next[dateKey];
        });
        return next;
      });
      setAutoSuggestFeedback(`Cleared meals for ${dateKeysToClear.length} day${dateKeysToClear.length === 1 ? "" : "s"}`);
    } catch (clearError) {
      console.error("Error clearing meals:", clearError);
      setAutoSuggestFeedback("Clear failed");
    }
  };

  const clearAllMeals = async () => {
    await clearMealsByMode("all");
  };

  const clearNonLockedMeals = async () => {
    await clearMealsByMode("non-locked");
  };

  const clearAssignedMeal = async (date: Date) => {
    const dateKey = toDateKey(date);

    try {
      await clearMealForDateKey(dateKey);
      setAssignedMealsByDate((prev) => {
        const next = { ...prev };
        delete next[dateKey];
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

  const formatExportDate = (date: Date) => {
    return new Intl.DateTimeFormat(DATE_LOCALE, { weekday: "long", day: "numeric", month: "long" }).format(date);
  };

  const buildExportText = () => {
    return days
      .map((date) => {
        const dateKey = toDateKey(date);
        const assignedMeal = assignedMealsByDate[dateKey];
        const metadata = resolvedMetadataForDateKey(dateKey);
        const isLocked = Boolean(lockedDaysByDate[dateKey]);
        const dayFlags: string[] = [];

        if (metadata.hasGuests) {
          dayFlags.push("Guests");
        }

        const officePeople: string[] = [];
        if (metadata.personAOfficeNextDay) officePeople.push("A");
        if (metadata.personBOfficeNextDay) officePeople.push("B");
        if (officePeople.length > 0) {
          dayFlags.push(`Office: ${officePeople.join(", ")}`);
        }

        if (isLocked) {
          dayFlags.push("Locked");
        }

        const dateLine = dayFlags.length > 0 ? `${formatExportDate(date)} - ${dayFlags.join(" · ")}` : formatExportDate(date);
        const lines: string[] = [dateLine];

        if (!assignedMeal) {
          lines.push("- No meal planned");
          return lines.join("\n");
        }

        if (assignedMeal.special) {
          lines.push(`- ${assignedMeal.special.name}`);
          return lines.join("\n");
        }

        if (assignedMeal.main) {
          lines.push(`- ${assignedMeal.main.name}`);
        } else {
          lines.push("- No main dish selected");
        }

        if (assignedMeal.sides.length > 0) {
          lines.push(`- Side: ${assignedMeal.sides.map((side) => side.name).join(", ")}`);
        }

        if (assignedMeal.dessert) {
          lines.push(`- Dessert: ${assignedMeal.dessert.name}`);
        }

        return lines.join("\n");
      })
      .join("\n\n");
  };

  const copyTextToClipboard = async (text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    if (typeof document !== "undefined") {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.setAttribute("readonly", "");
      textArea.style.position = "absolute";
      textArea.style.left = "-9999px";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    }
  };

  const exportMealPlan = async () => {
    const exportText = buildExportText();

    try {
      await copyTextToClipboard(exportText);
      setExportMessage("Copied to clipboard");
    } catch (exportError) {
      console.error("Error exporting meal plan:", exportError);
      setExportMessage("Copy failed");
    }

    setTimeout(() => {
      setExportMessage(null);
    }, 2000);
  };

  const editingFinalMeal: DayMealAssignment = editingMeal.special
    ? {
        special: editingMeal.special,
        main: null,
        sides: [],
        dessert: null,
      }
    : editingMeal;

  const editingViolations = selectedDayKey ? getRuleViolationsForMeal(selectedDayKey, editingFinalMeal, editingDayMetadata) : [];
  const plannedMealsInViewCount = days.reduce((count, date) => {
    const dateKey = toDateKey(date);
    return count + (hasAnyAssignedMeal(assignedMealsByDate[dateKey]) ? 1 : 0);
  }, 0);
  const nonLockedPlannedMealsInViewCount = days.reduce((count, date) => {
    const dateKey = toDateKey(date);
    const hasMeal = hasAnyAssignedMeal(assignedMealsByDate[dateKey]);
    const isLocked = Boolean(lockedDaysByDate[dateKey]);
    return count + (hasMeal && !isLocked ? 1 : 0);
  }, 0);

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
            <Button type="button" variant="outline" size="sm" onClick={autoSuggestAllDays}>
              Auto-Suggest All
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={autoSuggestSelectedDays} disabled={selectedDateKeys.length === 0}>
              Auto-Suggest Selected
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={clearNonLockedMeals} disabled={nonLockedPlannedMealsInViewCount === 0}>
              Clear
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={clearAllMeals} disabled={plannedMealsInViewCount === 0}>
              Clear All
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={exportMealPlan}>
              Export
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={goToPreviousWeek}>
              ◀
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={goToNextWeek}>
              ▶
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {exportMessage && <div className="mb-3 text-sm text-gray-600">{exportMessage}</div>}
          {autoSuggestMessage && <div className="mb-3 text-sm text-gray-600">{autoSuggestMessage}</div>}
          <div className="grid grid-cols-7 gap-3">
            {days.map((date, index) => {
              const dayName = DAY_NAMES[index % 7];
              const formattedDate = new Intl.DateTimeFormat(DATE_LOCALE, { day: "numeric", month: "short" }).format(date);
              const isCurrentWeekDay = date >= currentWeekStart && date <= currentWeekEnd;
              const dateKey = toDateKey(date);
              const assignedMeal = assignedMealsByDate[dateKey];
              const isLocked = Boolean(lockedDaysByDate[dateKey]);
              const isSelected = Boolean(selectedDaysByDate[dateKey]);
              const dayMetadata = resolvedMetadataForDateKey(dateKey);
              const isDayMenuOpen = openDayMenuDateKey === dateKey;
              const dayViolations = getRuleViolationsForMeal(dateKey, assignedMeal, dayMetadata);
              const mealDebugTitle = getMealDebugTitle(dateKey, assignedMeal);

              return (
                <Card key={date.toISOString()} className={isCurrentWeekDay ? "border-yellow-300 !bg-[#FFFACD] shadow-none" : "border-gray-200 shadow-none"}>
                  <CardContent className="p-3 min-h-[130px]">
                    <div className="mb-3 border-b border-gray-100 pb-2 flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs text-gray-500 uppercase tracking-wide">{dayName}</div>
                        <div className="text-sm font-semibold text-gray-900">{formattedDate}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Checkbox
                          checked={isSelected}
                          disabled={isLocked}
                          onCheckedChange={(checked) => toggleDaySelection(dateKey, checked === true)}
                          aria-label={`Select ${dayName} ${formattedDate}`}
                        />
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
                      <div className="space-y-2" title={mealDebugTitle}>
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
                        {dayViolations.length > 0 && (
                          <div className="text-[11px] text-red-700">⚠ {dayViolations.map((violation) => getViolationLabel(violation)).join(" · ")}</div>
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

                {editingViolations.length > 0 && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    ⚠ Rule warning: {editingViolations.map((violation) => getViolationLabel(violation)).join(" · ")}
                  </div>
                )}

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
