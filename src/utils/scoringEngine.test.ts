import { describe, expect, it } from "vitest";
import type { Dish } from "../types/dish";
import type { Rule } from "../types/rule";
import { evaluateNoFishBeforeOfficeDays, rankDishesForDay, scoreDishForDay } from "./scoringEngine";

const baseRule: Extract<Rule, { type: "no_fish_before_office_days" }> = {
  id: "rule-1",
  type: "no_fish_before_office_days",
  name: "No fish before office days",
  enabled: true,
  points: -50,
};

const fishDish: Dish = {
  id: "dish-fish",
  name: "Salmon",
  course: ["main"],
  proteins: ["fish"],
  isSpicy: false,
  time: "low",
  keyIngredients: ["salmon"],
  status: "enabled",
};

const chickenDish: Dish = {
  id: "dish-chicken",
  name: "Chicken Stir Fry",
  course: ["main"],
  proteins: ["chicken"],
  isSpicy: false,
  time: "low",
  keyIngredients: ["chicken"],
  status: "enabled",
};

const spicyDish: Dish = {
  id: "dish-spicy",
  name: "Spicy Beef Curry",
  course: ["main"],
  proteins: ["beef"],
  isSpicy: true,
  time: "high",
  keyIngredients: ["beef", "chilli"],
  status: "enabled",
};

const easyBeefDish: Dish = {
  id: "dish-beef-easy",
  name: "Beef Stir Fry",
  course: ["main"],
  proteins: ["beef"],
  isSpicy: false,
  time: "low",
  keyIngredients: ["beef", "broccoli"],
  status: "enabled",
};

describe("evaluateNoFishBeforeOfficeDays", () => {
  it("applies penalty when fish dish is planned before office day", () => {
    const result = evaluateNoFishBeforeOfficeDays(
      fishDish,
      { personAOfficeNextDay: true, personBOfficeNextDay: false },
      baseRule
    );

    expect(result.violated).toBe(true);
    expect(result.delta).toBe(-50);
  });

  it("does not apply penalty when no one goes to office next day", () => {
    const result = evaluateNoFishBeforeOfficeDays(
      fishDish,
      { personAOfficeNextDay: false, personBOfficeNextDay: false },
      baseRule
    );

    expect(result.violated).toBe(false);
    expect(result.delta).toBe(0);
  });

  it("does not apply penalty for non-fish dishes", () => {
    const result = evaluateNoFishBeforeOfficeDays(
      chickenDish,
      { personAOfficeNextDay: true, personBOfficeNextDay: true },
      baseRule
    );

    expect(result.violated).toBe(false);
    expect(result.delta).toBe(0);
  });

  it("does not apply penalty for special dishes", () => {
    const leftoversFishDish: Dish = {
      ...fishDish,
      id: "dish-leftovers",
      type: "leftovers",
    };

    const result = evaluateNoFishBeforeOfficeDays(
      leftoversFishDish,
      { personAOfficeNextDay: true, personBOfficeNextDay: true },
      baseRule
    );

    expect(result.violated).toBe(false);
    expect(result.delta).toBe(0);
  });

  it("uses default penalty when points are undefined", () => {
    const ruleWithoutPoints: Extract<Rule, { type: "no_fish_before_office_days" }> = {
      ...baseRule,
      points: undefined,
    };

    const result = evaluateNoFishBeforeOfficeDays(
      fishDish,
      { personAOfficeNextDay: false, personBOfficeNextDay: true },
      ruleWithoutPoints
    );

    expect(result.violated).toBe(true);
    expect(result.delta).toBe(-50);
  });
});

describe("scoreDishForDay", () => {
  it("adds rule deltas to base score", () => {
    const result = scoreDishForDay({
      dish: fishDish,
      dayContext: { personAOfficeNextDay: true, personBOfficeNextDay: false },
      rules: [baseRule],
      baseScore: 100,
    });

    expect(result.score).toBe(50);
    expect(result.appliedRules).toHaveLength(1);
    expect(result.appliedRules[0].ruleType).toBe("no_fish_before_office_days");
  });

  it("applies spicy guest and dual-office penalties", () => {
    const rules: Rule[] = [
      {
        id: "rule-spicy",
        type: "no_spicy_with_guests",
        name: "No spicy dishes with guests",
        enabled: true,
        points: -30,
      },
      {
        id: "rule-easy",
        type: "prefer_easy_on_dual_office_days",
        name: "Easy meals on dual-office days",
        enabled: true,
        points: -15,
      },
    ];

    const result = scoreDishForDay({
      dish: spicyDish,
      dayContext: { hasGuests: true, personAOfficeNextDay: true, personBOfficeNextDay: true },
      rules,
      baseScore: 100,
    });

    expect(result.score).toBe(55);
    expect(result.appliedRules.some((entry) => entry.ruleType === "no_spicy_with_guests" && entry.violated)).toBe(true);
    expect(result.appliedRules.some((entry) => entry.ruleType === "prefer_easy_on_dual_office_days" && entry.violated)).toBe(true);
  });

  it("rewards prioritized ingredient matches", () => {
    const prioritizeRule: Rule = {
      id: "rule-priority",
      type: "prioritize_ingredient",
      name: "Prioritize beef",
      enabled: true,
      points: 20,
      ingredient: "beef",
    };

    const result = scoreDishForDay({
      dish: easyBeefDish,
      dayContext: { personAOfficeNextDay: false, personBOfficeNextDay: false },
      rules: [prioritizeRule],
      baseScore: 100,
    });

    expect(result.score).toBe(120);
    expect(result.appliedRules[0].violated).toBe(false);
    expect(result.appliedRules[0].delta).toBe(20);
  });

  it("applies cooldown and consecutive protein penalties from history", () => {
    const rules: Rule[] = [
      {
        id: "rule-variety",
        type: "no_consecutive_same_protein",
        name: "Vary proteins",
        enabled: true,
        points: -20,
        maxConsecutiveDays: 1,
      },
      {
        id: "rule-cooldown",
        type: "dish_cooldown_period",
        name: "Dish cooldown",
        enabled: true,
        points: -100,
        cooldownDays: 5,
      },
    ];

    const result = scoreDishForDay({
      dish: chickenDish,
      dayContext: { personAOfficeNextDay: false, personBOfficeNextDay: false },
      rules,
      previousDishes: [
        {
          ...chickenDish,
          id: "dish-other-chicken",
          name: "Chicken Wrap",
        },
        fishDish,
        chickenDish,
      ],
      baseScore: 100,
    });

    expect(result.score).toBe(-20);
    expect(result.appliedRules.some((entry) => entry.ruleType === "no_consecutive_same_protein" && entry.violated)).toBe(true);
    expect(result.appliedRules.some((entry) => entry.ruleType === "dish_cooldown_period" && entry.violated)).toBe(true);
  });
});

describe("rankDishesForDay", () => {
  it("ranks dishes by descending score", () => {
    const rules: Rule[] = [
      {
        id: "rule-priority",
        type: "prioritize_ingredient",
        name: "Prioritize beef",
        enabled: true,
        points: 20,
        ingredient: "beef",
      },
      baseRule,
    ];

    const ranked = rankDishesForDay({
      dishes: [fishDish, easyBeefDish, chickenDish],
      dayContext: { personAOfficeNextDay: true, personBOfficeNextDay: false },
      rules,
      previousDishes: [],
      baseScore: 100,
    });

    expect(ranked[0].dish.id).toBe(easyBeefDish.id);
    expect(ranked[0].score).toBe(120);
    expect(ranked[2].dish.id).toBe(fishDish.id);
  });
});
