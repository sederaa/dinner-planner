import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { useDishes } from "../hooks/useDishes";
import { ensureRulesConfigSeeded, type RuleConfigRow } from "../lib/rulesConfig";
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

const FALLBACK_PLANNING_HORIZON_DAYS = 14;

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

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
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
  const [planningHorizonDays, setPlanningHorizonDays] = useState<number>(FALLBACK_PLANNING_HORIZON_DAYS);
  const [configuredRules, setConfiguredRules] = useState<Rule[]>(DEFAULT_RULES);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [autoSuggestMessage, setAutoSuggestMessage] = useState<string | null>(null);
  const [selectedDaysByDate, setSelectedDaysByDate] = useState<Record<string, boolean>>({});
  const [dayEditorOpen, setDayEditorOpen] = useState(false);
  const [dayEditorDate, setDayEditorDate] = useState<Date | null>(null);
  const [editingDayMetadata, setEditingDayMetadata] = useState<DayMetadata>({
    hasGuests: false,
    personAOfficeNextDay: true,
    personBOfficeNextDay: true,
  });
  const [mealPlansLoaded, setMealPlansLoaded] = useState(false);
  const [plannerLoading, setPlannerLoading] = useState(true);
  const [plannerError, setPlannerError] = useState<string | null>(null);
  const [plannerActionError, setPlannerActionError] = useState<string | null>(null);
  const [plannerLoadVersion, setPlannerLoadVersion] = useState(0);
  const [busyAction, setBusyAction] = useState<null | "lock" | "meal" | "day" | "suggest" | "clear" | "export">(null);
  const [isMobilePlannerLayout, setIsMobilePlannerLayout] = useState(false);
  const [editingMeal, setEditingMeal] = useState<DayMealAssignment>({
    special: null,
    main: null,
    sides: [],
    dessert: null,
  });

  const days = useMemo(() => {
    return Array.from({ length: planningHorizonDays }, (_, index) => addDays(calendarStart, index));
  }, [calendarStart, planningHorizonDays]);

  const rangeLabel = useMemo(() => {
    const rangeEnd = addDays(calendarStart, planningHorizonDays - 1);
    return formatRangeLabel(calendarStart, rangeEnd);
  }, [calendarStart, planningHorizonDays]);

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
  const dayEditorDateKey = dayEditorDate ? toDateKey(dayEditorDate) : null;
  const dayEditorLabel = dayEditorDate
    ? new Intl.DateTimeFormat(DATE_LOCALE, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(dayEditorDate)
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
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 980px)");
    const update = () => setIsMobilePlannerLayout(mediaQuery.matches);

    update();
    mediaQuery.addEventListener("change", update);

    return () => {
      mediaQuery.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    if (dishesLoading || mealPlansLoaded) return;

    const loadMealPlans = async () => {
      setPlannerLoading(true);
      setPlannerError(null);

      try {
        const [{ data: settingsData, error: settingsError }, { data, error }, rulesData] = await Promise.all([
          (supabase as any).from("user_settings").select("planning_horizon_days, default_office_days").limit(1).maybeSingle(),
          (supabase as any).from("meal_plans").select("*"),
          ensureRulesConfigSeeded(),
        ]);

        if (settingsError) throw settingsError;
        if (error) throw error;

        const horizonDays = Number(settingsData?.planning_horizon_days);
        setPlanningHorizonDays(horizonDays === 7 ? 7 : FALLBACK_PLANNING_HORIZON_DAYS);
        setDefaultOfficeDays(normalizeOfficeDays(settingsData?.default_office_days));

        if (rulesData) {
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
      } catch (loadError) {
        console.error("Error loading meal plans:", loadError);
        setPlannerError(getErrorMessage(loadError, "Failed to load planner data. Please try again."));
      } finally {
        setMealPlansLoaded(true);
        setPlannerLoading(false);
      }
    };

    loadMealPlans();
  }, [dishesLoading, mealPlansLoaded, plannerLoadVersion]);

  const retryPlannerLoad = () => {
    setMealPlansLoaded(false);
    setPlannerLoadVersion((current) => current + 1);
  };

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
    setBusyAction("lock");
    setPlannerActionError(null);

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
      setPlannerActionError(getErrorMessage(lockError, "Failed to update day lock."));
    } finally {
      setBusyAction(null);
    }
  };

  const setAutoSuggestFeedback = (message: string) => {
    setAutoSuggestMessage(message);
    setTimeout(() => {
      setAutoSuggestMessage(null);
    }, 2500);
  };

  const chooseSuggestedMainForDate = (dateKey: string, assignmentOverrides: Record<string, DayMealAssignment> = {}): MealOption | null => {
    const ranked = getRankedMainCandidatesForDate(dateKey, assignmentOverrides);

    const best = ranked[0]?.dish;
    return best ? { id: best.id, name: best.name } : null;
  };

  const getRankedMainCandidatesForDate = (dateKey: string, assignmentOverrides: Record<string, DayMealAssignment> = {}) => {
    if (autoSuggestableMainDishes.length === 0) return [];

    const metadata = resolvedMetadataForDateKey(dateKey);
    return rankDishesForDay({
      dishes: autoSuggestableMainDishes,
      dayContext: {
        hasGuests: metadata.hasGuests,
        personAOfficeNextDay: metadata.personAOfficeNextDay,
        personBOfficeNextDay: metadata.personBOfficeNextDay,
      },
      rules: configuredRules,
      previousDishes: getPreviousDishesForDateKey(dateKey, assignmentOverrides),
    });
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

  const buildCompactViolationSummary = (appliedRules: AppliedRuleResult[]) => {
    const violations = appliedRules.filter((rule) => rule.violated);
    if (violations.length === 0) return "No violations";

    const labels = violations
      .map((violation) => {
        const matchingRule = configuredRules.find((rule) => rule.type === violation.ruleType);
        return matchingRule?.name || violation.ruleType;
      })
      .slice(0, 2);

    return `${violations.length} violation${violations.length === 1 ? "" : "s"}: ${labels.join(" · ")}`;
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

    const ranked = getRankedMainCandidatesForDate(dateKey);

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

  const openDayEditorForDate = (date: Date) => {
    const dateKey = toDateKey(date);
    setEditingDayMetadata(resolvedMetadataForDateKey(dateKey));
    setDayEditorDate(date);
    setDayEditorOpen(true);
    setOpenDayMenuDateKey(null);
  };

  const saveDayMetadataFromEditor = async () => {
    if (!dayEditorDateKey) return;
    setBusyAction("day");
    setPlannerActionError(null);

    try {
      await persistDayMetadata(dayEditorDateKey, editingDayMetadata);
      setDayMetadataByDate((prev) => {
        const shouldKeep = hasMetadataOverride(dayEditorDateKey, editingDayMetadata);
        if (!shouldKeep) {
          const next = { ...prev };
          delete next[dayEditorDateKey];
          return next;
        }

        return {
          ...prev,
          [dayEditorDateKey]: editingDayMetadata,
        };
      });
      setDayEditorOpen(false);
    } catch (metadataError) {
      console.error("Error saving day details:", metadataError);
      setPlannerActionError(getErrorMessage(metadataError, "Failed to save day details."));
    } finally {
      setBusyAction(null);
    }
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

    setBusyAction("suggest");
    setPlannerActionError(null);

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
      setPlannerActionError(getErrorMessage(suggestError, "Failed to auto-suggest meals."));
    } finally {
      setBusyAction(null);
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
    const metadata = resolvedMetadataForDateKey(selectedDayKey);
    const shouldKeepMetadataRow = hasMetadataOverride(selectedDayKey, metadata);
    const isLocked = Boolean(lockedDaysByDate[selectedDayKey]);
    setBusyAction("meal");
    setPlannerActionError(null);

    try {
      if (hasAny) {
        await persistMealAssignment(selectedDayKey, finalMeal, metadata);
        setAssignedMealsByDate((prev) => ({
          ...prev,
          [selectedDayKey]: finalMeal,
        }));
      } else {
        if (isLocked || shouldKeepMetadataRow) {
          const payload: MealPlanInsert = {
            date: selectedDayKey,
            main_dish_id: null,
            main_dish_type: null,
            side_dish_ids: [],
            dessert_dish_id: null,
            has_guests: metadata.hasGuests,
            person_a_office_next_day: metadata.personAOfficeNextDay,
            person_b_office_next_day: metadata.personBOfficeNextDay,
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

      }
      setMealEditorOpen(false);
    } catch (saveError) {
      console.error("Error saving meal assignment:", saveError);
      setPlannerActionError(getErrorMessage(saveError, "Failed to save meal assignment."));
    } finally {
      setBusyAction(null);
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

    setBusyAction("clear");
    setPlannerActionError(null);

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
      setPlannerActionError(getErrorMessage(clearError, "Failed to clear meals."));
    } finally {
      setBusyAction(null);
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
    setBusyAction("clear");
    setPlannerActionError(null);

    try {
      await clearMealForDateKey(dateKey);
      setAssignedMealsByDate((prev) => {
        const next = { ...prev };
        delete next[dateKey];
        return next;
      });
    } catch (clearError) {
      console.error("Error clearing meal assignment:", clearError);
      setPlannerActionError(getErrorMessage(clearError, "Failed to clear meal assignment."));
    } finally {
      setBusyAction(null);
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
    setBusyAction("export");
    setPlannerActionError(null);

    try {
      await copyTextToClipboard(exportText);
      setExportMessage("Copied to clipboard");
    } catch (exportError) {
      console.error("Error exporting meal plan:", exportError);
      setExportMessage("Copy failed");
      setPlannerActionError(getErrorMessage(exportError, "Failed to copy meal plan to clipboard."));
    } finally {
      setBusyAction(null);
    }

    setTimeout(() => {
      setExportMessage(null);
    }, 2000);
  };

  const rankedMainCandidatesForSelectedDay = selectedDayKey ? getRankedMainCandidatesForDate(selectedDayKey) : [];
  const rankedMainCandidatesById = new Map(rankedMainCandidatesForSelectedDay.map((entry) => [entry.dish.id, entry]));
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
  const isBusy = busyAction !== null;

  return (
    <div className="page-root">
      <Card className="surface-panel">
        <CardContent>
          <h2 className="page-title">Meal Planner</h2>
          <p className="page-subtitle">Plan your dinners for the next 1-2 weeks with rule-aware suggestions.</p>
        </CardContent>
      </Card>

      <Card className="surface-panel">
        <CardHeader className="section-header-row">
          <CardTitle>Week of {rangeLabel}</CardTitle>
          <div className="planner-toolbar-actions">
            <Button type="button" variant="outline" size="sm" onClick={autoSuggestAllDays} disabled={plannerLoading || isBusy}>
              Auto-Suggest All
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={autoSuggestSelectedDays}
              disabled={plannerLoading || isBusy || selectedDateKeys.length === 0}
            >
              Auto-Suggest Selected
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clearNonLockedMeals}
              disabled={plannerLoading || isBusy || nonLockedPlannedMealsInViewCount === 0}
            >
              Clear
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={clearAllMeals} disabled={plannerLoading || isBusy || plannedMealsInViewCount === 0}>
              Clear All
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={exportMealPlan} disabled={plannerLoading || isBusy}>
              Export
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={goToPreviousWeek} disabled={plannerLoading || isBusy}>
              ◀
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={goToNextWeek} disabled={plannerLoading || isBusy}>
              ▶
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {plannerLoading ? (
            <div className="state-info">Loading planner data...</div>
          ) : plannerError ? (
            <div className="state-error">
              <div>{plannerError}</div>
              <Button type="button" variant="outline" size="sm" onClick={retryPlannerLoad}>
                Retry
              </Button>
            </div>
          ) : (
            <>
              {exportMessage && <div className="state-info">{exportMessage}</div>}
              {autoSuggestMessage && <div className="state-info">{autoSuggestMessage}</div>}
              {plannerActionError && <div className="state-error-text">{plannerActionError}</div>}
              <div className={isMobilePlannerLayout ? "planner-day-grid-mobile" : "planner-day-grid-desktop"}>
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
                <Card key={date.toISOString()} className={isCurrentWeekDay ? "planner-day-card planner-day-card-current" : "planner-day-card"}>
                  <CardContent className="planner-day-content">
                    <div className="planner-day-header">
                      <div className="planner-day-header-left">
                        <Checkbox
                          checked={isSelected}
                          disabled={isLocked || plannerLoading || isBusy}
                          onCheckedChange={(checked) => toggleDaySelection(dateKey, checked === true)}
                          aria-label={`Select ${dayName} ${formattedDate}`}
                        />
                        <div>
                          <div className="planner-day-label">{dayName}</div>
                          <div className="planner-day-date">{formattedDate}</div>
                        </div>
                      </div>
                      <div className="planner-day-header-right">
                        <div className="planner-menu-wrap" ref={isDayMenuOpen ? openDayMenuContainerRef : undefined}>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="planner-menu-trigger"
                            disabled={plannerLoading || isBusy}
                            onClick={() => setOpenDayMenuDateKey((current) => (current === dateKey ? null : dateKey))}
                            aria-label={`Open actions for ${dayName} ${formattedDate}`}
                            title="Day actions"
                          >
                            ⋯
                          </Button>

                          {isDayMenuOpen && (
                            <div className="planner-menu" role="menu" aria-label={`Actions for ${dayName} ${formattedDate}`}>
                              <button
                                type="button"
                                className="planner-menu-item"
                                disabled={isBusy}
                                onClick={() => openDayEditorForDate(date)}
                              >
                                Edit day details
                              </button>
                              <button
                                type="button"
                                className="planner-menu-item"
                                disabled={isBusy}
                                onClick={async () => {
                                  await toggleDayLock(date);
                                  setOpenDayMenuDateKey(null);
                                }}
                              >
                                {isLocked ? "Unlock day" : "Lock day"}
                              </button>
                              <div className="planner-menu-divider" />
                              <button
                                type="button"
                                className="planner-menu-item danger-text"
                                disabled={!assignedMeal || isBusy}
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
                    {(dayMetadata.hasGuests || dayMetadata.personAOfficeNextDay || dayMetadata.personBOfficeNextDay || isLocked) && (
                      <div className="planner-day-flags">
                        {dayMetadata.personAOfficeNextDay && <span title="Person A goes to office the next day">🏢A</span>}
                        {dayMetadata.personBOfficeNextDay && <span title="Person B goes to office the next day">🏢B</span>}
                        {dayMetadata.hasGuests && <span title="Guests are coming for this day">👥</span>}
                        {isLocked && <span title="This day is locked from auto-suggest">🔒</span>}
                      </div>
                    )}
                    {assignedMeal ? (
                      <div className="planner-day-body" title={mealDebugTitle}>
                        {assignedMeal.special ? (
                          <div className="text-sm font-medium">Special: {assignedMeal.special.name}</div>
                        ) : (
                          <>
                            {assignedMeal.main && <div className="text-sm font-medium">Main: {assignedMeal.main.name}</div>}
                            {assignedMeal.sides.length > 0 && <div className="text-xs text-muted-foreground">Sides: {assignedMeal.sides.map((side) => side.name).join(", ")}</div>}
                            {assignedMeal.dessert && <div className="text-xs text-muted-foreground">Dessert: {assignedMeal.dessert.name}</div>}
                          </>
                        )}
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={plannerLoading || isBusy}
                            onClick={() => openMealEditorForDate(date)}
                          >
                            Change
                          </Button>
                        </div>
                        {dayViolations.length > 0 && (
                          <div className="planner-violation">⚠ {dayViolations.map((violation) => getViolationLabel(violation)).join(" · ")}</div>
                        )}
                      </div>
                    ) : (
                      <div className="planner-day-body">
                        <div className="text-xs text-muted-foreground">No meal planned</div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={plannerLoading || isBusy}
                          onClick={() => openMealEditorForDate(date)}
                        >
                          + Add meal
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={mealEditorOpen} onOpenChange={setMealEditorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit meal for {selectedDayLabel}</DialogTitle>
            <DialogDescription>Select meal components. Day details are managed from the day actions menu.</DialogDescription>
          </DialogHeader>

          <div className="planner-meal-editor">
            {dishesLoading ? (
              <div className="state-info">Loading dishes...</div>
            ) : (
              <>
                <Button
                  type="button"
                  variant={editingMeal.special?.id === "EATING_OUT" ? "default" : "outline"}
                  className="meal-option-button"
                  onClick={toggleEatingOut}
                >
                  Eating Out
                </Button>

                <div className="form-section">
                  <div className="meal-section-title">Main</div>
                  {mainMealOptions.length === 0 ? (
                    <div className="state-info">No available main dishes yet.</div>
                  ) : (
                    <div className="meal-option-list">
                      {mainMealOptions.map((meal) => {
                        const isSelected = editingMeal.main?.id === meal.id;
                        const rankedEntry = rankedMainCandidatesById.get(meal.id);
                        const compactLine = meal.id === "LEFTOVERS" ? "Manual only" : rankedEntry ? `Score ${rankedEntry.score} · ${buildCompactViolationSummary(rankedEntry.appliedRules)}` : "Manual only";
                        const detailsTitle = meal.id === "LEFTOVERS" ? "Leftovers (manual-only, excluded from auto-suggest scoring)" : rankedEntry ? `Score: ${rankedEntry.score}\n${buildRuleSummary(rankedEntry.appliedRules)}` : `${meal.name}\nManual-only or non-auto-suggestable main dish`;
                        return (
                          <Button
                            key={meal.id}
                            type="button"
                            variant={isSelected ? "secondary" : "outline"}
                            className="meal-option-button"
                            disabled={editingMeal.special !== null}
                            onClick={() => setMainMeal(meal)}
                            title={detailsTitle}
                          >
                            <span className="meal-option-name">{meal.name}</span>
                            <span className="meal-option-meta">{compactLine}</span>
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="form-section">
                  <div className="meal-section-title">Sides (select multiple)</div>
                  {sideMealOptions.length === 0 ? (
                    <div className="state-info">No side dishes available.</div>
                  ) : (
                    <div className="meal-option-list">
                      {sideMealOptions.map((meal) => {
                        const isSelected = editingMeal.sides.some((side) => side.id === meal.id);
                        return (
                          <Button
                            key={meal.id}
                            type="button"
                            variant={isSelected ? "secondary" : "outline"}
                            className="meal-option-button"
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

                <div className="form-section">
                  <div className="meal-section-title">Dessert (optional)</div>
                  <Button
                    type="button"
                    variant={editingMeal.dessert === null ? "secondary" : "outline"}
                    className="meal-option-button"
                    disabled={editingMeal.special !== null}
                    onClick={() => setDessertMeal(null)}
                  >
                    No dessert
                  </Button>
                  {dessertMealOptions.length === 0 ? (
                    <div className="state-info">No dessert dishes available.</div>
                  ) : (
                    <div className="meal-option-list">
                      {dessertMealOptions.map((meal) => {
                        const isSelected = editingMeal.dessert?.id === meal.id;
                        return (
                          <Button
                            key={meal.id}
                            type="button"
                            variant={isSelected ? "secondary" : "outline"}
                            className="meal-option-button"
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

                <div className="form-actions">
                  <Button type="button" variant="outline" onClick={() => setMealEditorOpen(false)} disabled={busyAction === "meal"}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={saveMealAssignment} disabled={busyAction === "meal"}>
                    {busyAction === "meal" ? "Saving..." : "Save meal"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dayEditorOpen} onOpenChange={setDayEditorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit day details for {dayEditorLabel}</DialogTitle>
            <DialogDescription>These settings are saved separately and used by meal scoring in Edit Meal.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <label className="inline-flex items-center text-sm gap-2">
              <Checkbox
                checked={editingDayMetadata.hasGuests}
                onCheckedChange={(checked) => setEditingDayMetadata((prev) => ({ ...prev, hasGuests: checked === true }))}
              />
              Guests coming
            </label>

            <div className="text-sm font-medium">Office next day</div>
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

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setDayEditorOpen(false)} disabled={busyAction === "day"}>
                Cancel
              </Button>
              <Button type="button" onClick={saveDayMetadataFromEditor} disabled={busyAction === "day"}>
                {busyAction === "day" ? "Saving..." : "Save day"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
