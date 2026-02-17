import { describe, expect, it } from "vitest";
import type { Dish } from "../types/dish";
import type { Rule } from "../types/rule";
import { evaluateNoFishBeforeOfficeDays, scoreDishForDay } from "./scoringEngine";

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
});
