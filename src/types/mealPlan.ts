export type SpecialDish = "LEFTOVERS" | "EATING_OUT";

export interface MealPlan {
  id: string;
  date: Date;
  mainDishId: string | SpecialDish | null; // Special values for leftover/eating out, null if blocked
  sideDishIds: string[]; // Array of side dish IDs (no maximum)
  dessertDishId?: string; // Optional dessert
  hasGuests: boolean;
  sebGoesToOffice: boolean; // Next day
  sherryGoesToOffice: boolean; // Next day
  locked: boolean; // If true, auto-suggest won't replace this day
  isBlocked: boolean; // If true, day is intentionally kept clear (no cooking)
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface MealPlanFormData {
  date: Date;
  mainDishId: string | SpecialDish | null;
  sideDishIds: string[];
  dessertDishId?: string;
  hasGuests: boolean;
  sebGoesToOffice: boolean;
  sherryGoesToOffice: boolean;
  locked: boolean;
  isBlocked: boolean;
  notes?: string;
}
