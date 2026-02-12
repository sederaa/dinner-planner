// Core data models for the Dinner Planner app

export * from "./database";
export type DishStatus = "enabled" | "manual_only" | "disabled";

export type DishType = "main" | "side" | "dessert";

export type DishTime = "low" | "medium" | "high";

export interface Dish {
  id: string;
  name: string;
  type: DishType[]; // A dish can be multiple types
  proteins?: string[]; // ["fish", "chicken"], ["beef"], undefined for vegetarian/vegan
  isSpicy: boolean;
  time: DishTime; // Combined prep time and difficulty
  keyIngredients: string[];
  status: DishStatus;
  notes?: string;
  tags?: string[];
}

export type SpecialMealType = "LEFTOVERS" | "EATING_OUT";

export interface MealPlan {
  id: string;
  date: Date;
  mainDishId: string | SpecialMealType | null; // Special values for special meals, null if blocked
  sideDishIds: string[]; // Array of side dish IDs (no maximum)
  dessertDishId?: string;
  hasGuests: boolean;
  personAGoesToOffice: boolean; // Next day
  personBGoesToOffice: boolean; // Next day
  locked: boolean; // If true, auto-suggest won't replace this day
  isBlocked: boolean; // If true, day is intentionally kept clear (no cooking)
  notes?: string;
}

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
  points?: number; // Points impact: negative = deducted when violated, positive = awarded when satisfied
} & (
  | { type: "no_fish_before_office_days" }
  | { type: "no_consecutive_same_protein"; maxConsecutiveDays: number }
  | { type: "no_spicy_with_guests" }
  | { type: "prefer_easy_on_dual_office_days" }
  | { type: "prioritize_ingredient"; ingredient: string }
  | { type: "dish_cooldown_period"; cooldownDays: number }
);

export interface UserSettings {
  planningHorizonDays: number; // 7, 14, etc. (default: 14)
  defaultOfficeDays: {
    personA: string[]; // ["monday", "tuesday", "wednesday", "thursday"]
    personB: string[]; // ["monday", "tuesday", "wednesday", "thursday"]
  };
}

// Supabase database types
export interface Database {
  public: {
    Tables: {
      dishes: {
        Row: Omit<Dish, "type" | "proteins" | "keyIngredients" | "tags"> & {
          type: string[];
          proteins: string[] | null;
          key_ingredients: string[];
          tags: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Dish, "id" | "type" | "proteins" | "keyIngredients" | "tags"> & {
          id?: string;
          type: string[];
          proteins?: string[] | null;
          key_ingredients: string[];
          tags?: string[] | null;
        };
        Update: Partial<Database["public"]["Tables"]["dishes"]["Insert"]>;
      };
      meal_plans: {
        Row: {
          id: string;
          date: string;
          main_dish_id: string | null;
          main_dish_type: "dish" | "leftovers" | "eating_out" | null;
          side_dish_ids: string[];
          dessert_dish_id: string | null;
          has_guests: boolean;
          person_a_office_next_day: boolean;
          person_b_office_next_day: boolean;
          locked: boolean;
          is_blocked: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          MealPlan,
          "id" | "date" | "mainDishId" | "sideDishIds" | "dessertDishId" | "hasGuests" | "personAGoesToOffice" | "personBGoesToOffice" | "isBlocked"
        > & {
          id?: string;
          date: string;
          main_dish_id?: string | null;
          main_dish_type?: "dish" | "leftovers" | "eating_out" | null;
          side_dish_ids?: string[];
          dessert_dish_id?: string | null;
          has_guests?: boolean;
          person_a_office_next_day?: boolean;
          person_b_office_next_day?: boolean;
          is_blocked?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["meal_plans"]["Insert"]>;
      };
      rules_config: {
        Row: {
          id: string;
          name: string;
          enabled: boolean;
          rule_type: RuleType;
          parameters: Record<string, any>;
          points: number | null;
          updated_at: string;
        };
        Insert: Omit<Rule, "id"> & {
          id?: string;
          rule_type: RuleType;
          parameters: Record<string, any>;
        };
        Update: Partial<Database["public"]["Tables"]["rules_config"]["Insert"]>;
      };
      user_settings: {
        Row: {
          id: string;
          planning_horizon_days: number;
          default_office_days: {
            personA: string[];
            personB: string[];
          };
          updated_at: string;
        };
        Insert: Omit<UserSettings, "planningHorizonDays" | "defaultOfficeDays"> & {
          id?: string;
          planning_horizon_days?: number;
          default_office_days?: {
            personA: string[];
            personB: string[];
          };
        };
        Update: Partial<Database["public"]["Tables"]["user_settings"]["Insert"]>;
      };
    };
  };
}
