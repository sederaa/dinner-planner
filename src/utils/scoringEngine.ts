import type { Dish } from "../types/dish";
import type { Rule } from "../types/rule";

export type DayRuleContext = {
  personAOfficeNextDay: boolean;
  personBOfficeNextDay: boolean;
  hasGuests?: boolean;
};

type RuleEvaluationContext = {
  previousDishes: Dish[];
};

export type AppliedRuleResult = {
  ruleType: Rule["type"];
  delta: number;
  violated: boolean;
  reason: string;
};

export type DishScoreResult = {
  score: number;
  appliedRules: AppliedRuleResult[];
};

export type RankedDishResult = DishScoreResult & {
  dish: Dish;
};

const DEFAULT_NO_FISH_POINTS = -50;
const DEFAULT_NO_CONSECUTIVE_PROTEIN_POINTS = -20;
const DEFAULT_NO_SPICY_WITH_GUESTS_POINTS = -30;
const DEFAULT_PREFER_EASY_POINTS = -15;
const DEFAULT_PRIORITIZE_INGREDIENT_POINTS = 20;
const DEFAULT_COOLDOWN_POINTS = -100;

const hasFishProtein = (dish: Dish) => {
  return (dish.proteins || []).some((protein) => protein.toLowerCase() === "fish");
};

const normalizeText = (value: string) => value.trim().toLowerCase();

const normalizeList = (values: string[] | undefined) => {
  return (values || []).map(normalizeText).filter(Boolean);
};

const hasProteinOverlap = (left: Dish, right: Dish) => {
  const leftProteins = new Set(normalizeList(left.proteins));
  if (leftProteins.size === 0) return false;
  return normalizeList(right.proteins).some((protein) => leftProteins.has(protein));
};

const isLowTimeDish = (dish: Dish) => dish.time === "low";

const includesIngredient = (dish: Dish, ingredient: string) => {
  const normalizedIngredient = normalizeText(ingredient);
  if (!normalizedIngredient) return false;

  const ingredients = normalizeList(dish.keyIngredients);
  const proteins = normalizeList(dish.proteins);
  const name = normalizeText(dish.name);

  return ingredients.some((item) => item.includes(normalizedIngredient)) || proteins.some((item) => item.includes(normalizedIngredient)) || name.includes(normalizedIngredient);
};

const isSpecialDish = (dish: Dish) => {
  return dish.type === "leftovers" || dish.type === "eating_out";
};

export const evaluateNoFishBeforeOfficeDays = (
  dish: Dish,
  dayContext: DayRuleContext,
  rule: Extract<Rule, { type: "no_fish_before_office_days" }>
): AppliedRuleResult => {
  if (!rule.enabled) {
    return {
      ruleType: rule.type,
      delta: 0,
      violated: false,
      reason: "Rule disabled",
    };
  }

  if (isSpecialDish(dish)) {
    return {
      ruleType: rule.type,
      delta: 0,
      violated: false,
      reason: "Special dishes are excluded",
    };
  }

  const officeNextDay = dayContext.personAOfficeNextDay || dayContext.personBOfficeNextDay;
  if (!officeNextDay || !hasFishProtein(dish)) {
    return {
      ruleType: rule.type,
      delta: 0,
      violated: false,
      reason: "No violation",
    };
  }

  const penalty = rule.points ?? DEFAULT_NO_FISH_POINTS;
  return {
    ruleType: rule.type,
    delta: penalty,
    violated: true,
    reason: "Fish dish before office day",
  };
};

const evaluateNoConsecutiveSameProtein = (
  dish: Dish,
  context: RuleEvaluationContext,
  rule: Extract<Rule, { type: "no_consecutive_same_protein" }>
): AppliedRuleResult => {
  if (!rule.enabled) {
    return {
      ruleType: rule.type,
      delta: 0,
      violated: false,
      reason: "Rule disabled",
    };
  }

  if (isSpecialDish(dish)) {
    return {
      ruleType: rule.type,
      delta: 0,
      violated: false,
      reason: "Special dishes are excluded",
    };
  }

  const maxConsecutiveDays = Math.max(1, rule.maxConsecutiveDays);
  let consecutiveDays = 0;

  for (const previousDish of context.previousDishes) {
    if (isSpecialDish(previousDish)) break;
    if (!hasProteinOverlap(dish, previousDish)) break;
    consecutiveDays += 1;
  }

  if (consecutiveDays < maxConsecutiveDays) {
    return {
      ruleType: rule.type,
      delta: 0,
      violated: false,
      reason: "No violation",
    };
  }

  return {
    ruleType: rule.type,
    delta: rule.points ?? DEFAULT_NO_CONSECUTIVE_PROTEIN_POINTS,
    violated: true,
    reason: "Consecutive protein streak exceeded",
  };
};

const evaluateNoSpicyWithGuests = (
  dish: Dish,
  dayContext: DayRuleContext,
  rule: Extract<Rule, { type: "no_spicy_with_guests" }>
): AppliedRuleResult => {
  if (!rule.enabled) {
    return {
      ruleType: rule.type,
      delta: 0,
      violated: false,
      reason: "Rule disabled",
    };
  }

  if (isSpecialDish(dish)) {
    return {
      ruleType: rule.type,
      delta: 0,
      violated: false,
      reason: "Special dishes are excluded",
    };
  }

  if (!dayContext.hasGuests || !dish.isSpicy) {
    return {
      ruleType: rule.type,
      delta: 0,
      violated: false,
      reason: "No violation",
    };
  }

  return {
    ruleType: rule.type,
    delta: rule.points ?? DEFAULT_NO_SPICY_WITH_GUESTS_POINTS,
    violated: true,
    reason: "Spicy dish with guests",
  };
};

const evaluatePreferEasyOnDualOfficeDays = (
  dish: Dish,
  dayContext: DayRuleContext,
  rule: Extract<Rule, { type: "prefer_easy_on_dual_office_days" }>
): AppliedRuleResult => {
  if (!rule.enabled) {
    return {
      ruleType: rule.type,
      delta: 0,
      violated: false,
      reason: "Rule disabled",
    };
  }

  if (isSpecialDish(dish)) {
    return {
      ruleType: rule.type,
      delta: 0,
      violated: false,
      reason: "Special dishes are excluded",
    };
  }

  const dualOfficeDay = dayContext.personAOfficeNextDay && dayContext.personBOfficeNextDay;
  if (!dualOfficeDay || isLowTimeDish(dish)) {
    return {
      ruleType: rule.type,
      delta: 0,
      violated: false,
      reason: "No violation",
    };
  }

  return {
    ruleType: rule.type,
    delta: rule.points ?? DEFAULT_PREFER_EASY_POINTS,
    violated: true,
    reason: "High-effort meal before dual office day",
  };
};

const evaluatePrioritizeIngredient = (
  dish: Dish,
  rule: Extract<Rule, { type: "prioritize_ingredient" }>
): AppliedRuleResult => {
  if (!rule.enabled) {
    return {
      ruleType: rule.type,
      delta: 0,
      violated: false,
      reason: "Rule disabled",
    };
  }

  if (isSpecialDish(dish)) {
    return {
      ruleType: rule.type,
      delta: 0,
      violated: false,
      reason: "Special dishes are excluded",
    };
  }

  if (!includesIngredient(dish, rule.ingredient)) {
    return {
      ruleType: rule.type,
      delta: 0,
      violated: false,
      reason: "Ingredient not matched",
    };
  }

  return {
    ruleType: rule.type,
    delta: rule.points ?? DEFAULT_PRIORITIZE_INGREDIENT_POINTS,
    violated: false,
    reason: "Prioritized ingredient matched",
  };
};

const evaluateDishCooldownPeriod = (
  dish: Dish,
  context: RuleEvaluationContext,
  rule: Extract<Rule, { type: "dish_cooldown_period" }>
): AppliedRuleResult => {
  if (!rule.enabled) {
    return {
      ruleType: rule.type,
      delta: 0,
      violated: false,
      reason: "Rule disabled",
    };
  }

  if (isSpecialDish(dish)) {
    return {
      ruleType: rule.type,
      delta: 0,
      violated: false,
      reason: "Special dishes are excluded",
    };
  }

  const cooldownDays = Math.max(1, rule.cooldownDays);
  const recentWindow = context.previousDishes.slice(0, cooldownDays);
  const repeatedTooSoon = recentWindow.some((previousDish) => previousDish.id === dish.id);

  if (!repeatedTooSoon) {
    return {
      ruleType: rule.type,
      delta: 0,
      violated: false,
      reason: "No violation",
    };
  }

  return {
    ruleType: rule.type,
    delta: rule.points ?? DEFAULT_COOLDOWN_POINTS,
    violated: true,
    reason: "Dish repeated within cooldown period",
  };
};

export const scoreDishForDay = (params: {
  dish: Dish;
  dayContext: DayRuleContext;
  rules: Rule[];
  previousDishes?: Dish[];
  baseScore?: number;
}): DishScoreResult => {
  const { dish, dayContext, rules, previousDishes = [], baseScore = 100 } = params;
  const context: RuleEvaluationContext = { previousDishes };

  const appliedRules: AppliedRuleResult[] = [];

  for (const rule of rules) {
    if (rule.type === "no_fish_before_office_days") {
      appliedRules.push(evaluateNoFishBeforeOfficeDays(dish, dayContext, rule));
      continue;
    }

    if (rule.type === "no_consecutive_same_protein") {
      appliedRules.push(evaluateNoConsecutiveSameProtein(dish, context, rule));
      continue;
    }

    if (rule.type === "no_spicy_with_guests") {
      appliedRules.push(evaluateNoSpicyWithGuests(dish, dayContext, rule));
      continue;
    }

    if (rule.type === "prefer_easy_on_dual_office_days") {
      appliedRules.push(evaluatePreferEasyOnDualOfficeDays(dish, dayContext, rule));
      continue;
    }

    if (rule.type === "prioritize_ingredient") {
      appliedRules.push(evaluatePrioritizeIngredient(dish, rule));
      continue;
    }

    if (rule.type === "dish_cooldown_period") {
      appliedRules.push(evaluateDishCooldownPeriod(dish, context, rule));
    }
  }

  const score = appliedRules.reduce((currentScore, ruleResult) => currentScore + ruleResult.delta, baseScore);

  return {
    score,
    appliedRules,
  };
};

export const rankDishesForDay = (params: {
  dishes: Dish[];
  dayContext: DayRuleContext;
  rules: Rule[];
  previousDishes?: Dish[];
  baseScore?: number;
}): RankedDishResult[] => {
  const { dishes, dayContext, rules, previousDishes = [], baseScore } = params;

  return dishes
    .map((dish) => ({
      dish,
      ...scoreDishForDay({
        dish,
        dayContext,
        rules,
        previousDishes,
        baseScore,
      }),
    }))
    .sort((left, right) => {
      if (left.score !== right.score) return right.score - left.score;
      return left.dish.name.localeCompare(right.dish.name);
    });
};
