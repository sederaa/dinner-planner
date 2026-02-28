export type CourseType = "main" | "side" | "dessert";

export type DishTime = "low" | "medium" | "high";

export type DishStatus = "enabled" | "manual_only" | "disabled";

export type DishType = "cooked" | "leftovers" | "eating_out";

export interface Dish {
  id: string;
  name: string;
  course: CourseType[]; // A dish can be multiple courses
  proteins?: string[]; // ["fish", "chicken"], ["beef"], undefined for vegetarian/vegan
  isSpicy: boolean;
  time: DishTime; // Combined prep time and difficulty
  keyIngredients: string[];
  status: DishStatus; // enabled: auto-suggest, manual_only: only manual selection, disabled: hidden
  notes?: string;
  tags?: string[];
  type?: DishType; // default: "cooked"
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DishFormData {
  name: string;
  course: CourseType[];
  proteins: string[];
  isSpicy: boolean;
  time: DishTime;
  keyIngredients: string[];
  status: DishStatus;
  type?: DishType;
  notes?: string;
  tags?: string[];
}
