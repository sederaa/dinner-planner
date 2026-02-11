export type RuleType =
  | "no_fish_before_office_days"
  | "no_consecutive_same_protein"
  | "no_spicy_with_guests"
  | "prefer_easy_on_dual_office_days"
  | "prioritize_ingredient"
  | "dish_cooldown_period";

export type Rule = {
  id: string;
  name: string;
  enabled: boolean;
  points?: number; // Negative = deducted when violated, positive = awarded when satisfied
  updatedAt?: Date;
} & (
  | { type: "no_fish_before_office_days" }
  | { type: "no_consecutive_same_protein"; maxConsecutiveDays: number }
  | { type: "no_spicy_with_guests" }
  | { type: "prefer_easy_on_dual_office_days" }
  | { type: "prioritize_ingredient"; ingredient: string }
  | { type: "dish_cooldown_period"; cooldownDays: number }
);

// Helper type for rule parameters
export type RuleParameters = { maxConsecutiveDays: number } | { ingredient: string } | { cooldownDays: number } | Record<string, never>; // Empty object for rules without parameters

export interface RuleFormData {
  name: string;
  enabled: boolean;
  type: RuleType;
  points?: number;
  parameters: RuleParameters;
}

// Default rules configuration
export const DEFAULT_RULES: Rule[] = [
  {
    id: "default-1",
    type: "no_fish_before_office_days",
    name: "No fish before office days",
    enabled: true,
    points: -50,
  },
  {
    id: "default-2",
    type: "no_consecutive_same_protein",
    name: "Vary proteins",
    enabled: true,
    points: -20,
    maxConsecutiveDays: 1,
  },
  {
    id: "default-3",
    type: "no_spicy_with_guests",
    name: "No spicy dishes with guests",
    enabled: true,
    points: -30,
  },
  {
    id: "default-4",
    type: "prefer_easy_on_dual_office_days",
    name: "Easy meals on dual-office days",
    enabled: true,
    points: -15,
  },
  {
    id: "default-5",
    type: "prioritize_ingredient",
    name: "Prioritize ingredient",
    enabled: false,
    points: 20,
    ingredient: "",
  },
  {
    id: "default-6",
    type: "dish_cooldown_period",
    name: "Don't repeat dishes",
    enabled: true,
    points: -100,
    cooldownDays: 5,
  },
];
