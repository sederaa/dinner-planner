import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlannerPage } from "./PlannerPage";
import type { Database } from "../types/database";

type MealPlanRow = Database["public"]["Tables"]["meal_plans"]["Row"];

const mockData = vi.hoisted(() => {
  const today = new Date();
  const monday = new Date(today);
  const daysFromMonday = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - daysFromMonday);

  const dateKey = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;

  return {
    dishes: [
      {
        id: "dish-1",
        name: "Test Main Dish",
        course: ["main"],
        proteins: ["chicken"],
        isSpicy: false,
        time: "low",
        keyIngredients: ["chicken"],
        status: "enabled",
      },
    ],
    mealPlanRows: [
      {
        id: "metadata-only-row",
        date: dateKey,
        main_dish_id: null,
        main_dish_type: null,
        side_dish_ids: [],
        dessert_dish_id: null,
        has_guests: true,
        person_a_office_next_day: false,
        person_b_office_next_day: true,
        locked: false,
        is_blocked: false,
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ] as MealPlanRow[],
  };
});

vi.mock("../hooks/useDishes", () => ({
  useDishes: () => ({
    dishes: mockData.dishes,
    loading: false,
  }),
}));

vi.mock("../lib/supabase", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "user_settings") {
        return {
          select: () => ({
            limit: () => ({
              maybeSingle: async () => ({
                data: {
                  default_office_days: {
                    personA: ["monday", "tuesday", "wednesday", "thursday"],
                    personB: ["monday", "tuesday", "wednesday", "thursday"],
                  },
                },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "meal_plans") {
        return {
          select: async () => ({ data: mockData.mealPlanRows, error: null }),
          upsert: async () => ({ error: null }),
          delete: () => ({
            eq: async () => ({ error: null }),
          }),
        };
      }

      return {
        select: async () => ({ data: [], error: null }),
      };
    },
  },
}));

describe("PlannerPage", () => {
  it("does not show a scheduled meal when the row only contains metadata", async () => {
    render(<PlannerPage />);

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Change" })).not.toBeInTheDocument();
    });

    expect(screen.getAllByRole("button", { name: "+ Add meal" }).length).toBeGreaterThan(0);
  });

  it("shows Change when the row contains a scheduled meal", async () => {
    const today = new Date();
    const monday = new Date(today);
    const daysFromMonday = (monday.getDay() + 6) % 7;
    monday.setDate(monday.getDate() - daysFromMonday);

    const dateKey = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;

    mockData.mealPlanRows = [
      {
        id: "meal-row",
        date: dateKey,
        main_dish_id: "dish-1",
        main_dish_type: "dish",
        side_dish_ids: [],
        dessert_dish_id: null,
        has_guests: false,
        person_a_office_next_day: true,
        person_b_office_next_day: false,
        locked: false,
        is_blocked: false,
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ] as MealPlanRow[];

    render(<PlannerPage />);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Change" }).length).toBeGreaterThan(0);
    });
  });
});
