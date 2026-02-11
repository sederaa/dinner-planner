export type DishType = "main" | "side" | "dessert";

export type DishTime = "low" | "medium" | "high";

export type DishStatus = "enabled" | "manual_only" | "disabled";

export interface Dish {
  id: string;
  name: string;
  type: DishType[]; // A dish can be multiple types
  proteins?: string[]; // ["fish", "chicken"], ["beef"], undefined for vegetarian/vegan
  isSpicy: boolean;
  time: DishTime; // Combined prep time and difficulty
  keyIngredients: string[];
  status: DishStatus; // enabled: auto-suggest, manual_only: only manual selection, disabled: hidden
  notes?: string;
  tags?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DishFormData {
  name: string;
  type: DishType[];
  proteins: string[];
  isSpicy: boolean;
  time: DishTime;
  keyIngredients: string[];
  status: DishStatus;
  notes?: string;
  tags?: string[];
}
