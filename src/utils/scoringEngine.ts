import type { Dish } from "../types/dish";
import type { Rule } from "../types/rule";

export type DayRuleContext = {
  personAOfficeNextDay: boolean;
  personBOfficeNextDay: boolean;
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

const DEFAULT_NO_FISH_POINTS = -50;

const hasFishProtein = (dish: Dish) => {
  return (dish.proteins || []).some((protein) => protein.toLowerCase() === "fish");
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

export const scoreDishForDay = (params: {
  dish: Dish;
  dayContext: DayRuleContext;
  rules: Rule[];
  baseScore?: number;
}): DishScoreResult => {
  const { dish, dayContext, rules, baseScore = 100 } = params;

  const noFishRule = rules.find(
    (rule): rule is Extract<Rule, { type: "no_fish_before_office_days" }> =>
      rule.type === "no_fish_before_office_days"
  );

  const appliedRules: AppliedRuleResult[] = [];
  if (noFishRule) {
    appliedRules.push(evaluateNoFishBeforeOfficeDays(dish, dayContext, noFishRule));
  }

  const score = appliedRules.reduce((currentScore, ruleResult) => currentScore + ruleResult.delta, baseScore);

  return {
    score,
    appliedRules,
  };
};
