import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlannerPage } from "./PlannerPage";
import type { Database } from "../types/database";

type MealPlanRow = Database["public"]["Tables"]["meal_plans"]["Row"];

const getMondayDateKey = () => {
  const today = new Date();
  const monday = new Date(today);
  const daysFromMonday = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - daysFromMonday);

  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
};

const mockData = vi.hoisted(() => {
  const today = new Date();
  const monday = new Date(today);
  const daysFromMonday = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - daysFromMonday);

  const dateKey = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;

  return {
    userSettings: {
      planning_horizon_days: 14,
      default_office_days: {
        personA: ["monday", "tuesday", "wednesday", "thursday"],
        personB: ["monday", "tuesday", "wednesday", "thursday"],
      },
    },
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
      {
        id: "dish-fish",
        name: "Salmon",
        course: ["main"],
        proteins: ["fish"],
        isSpicy: false,
        time: "low",
        keyIngredients: ["salmon"],
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
    rulesConfigRows: [] as Array<{
      id: string;
      name: string;
      enabled: boolean;
      rule_type: string;
      parameters: Record<string, unknown>;
      points: number | null;
    }>,
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
                data: mockData.userSettings,
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

      if (table === "rules_config") {
        return {
          select: async () => ({ data: mockData.rulesConfigRows, error: null }),
          insert: async (payload: Array<Record<string, unknown>>) => {
            payload.forEach((entry, index) => {
              mockData.rulesConfigRows.push({
                id: `rule-seed-${mockData.rulesConfigRows.length + index + 1}`,
                name: String(entry.name || ""),
                enabled: Boolean(entry.enabled),
                rule_type: String(entry.rule_type || ""),
                parameters: (entry.parameters as Record<string, unknown>) || {},
                points: typeof entry.points === "number" ? entry.points : null,
              });
            });
            return { error: null };
          },
        };
      }

      return {
        select: async () => ({ data: [], error: null }),
      };
    },
  },
}));

describe("PlannerPage", () => {
  beforeEach(() => {
    mockData.userSettings = {
      planning_horizon_days: 14,
      default_office_days: {
        personA: ["monday", "tuesday", "wednesday", "thursday"],
        personB: ["monday", "tuesday", "wednesday", "thursday"],
      },
    };

    const dateKey = getMondayDateKey();
    mockData.dishes = [
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
      {
        id: "dish-fish",
        name: "Salmon",
        course: ["main"],
        proteins: ["fish"],
        isSpicy: false,
        time: "low",
        keyIngredients: ["salmon"],
        status: "enabled",
      },
    ];
    mockData.rulesConfigRows = [];
    mockData.mealPlanRows = [
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
    ] as MealPlanRow[];
  });

  it("seeds default rules when rules_config is empty", async () => {
    mockData.mealPlanRows = [] as MealPlanRow[];
    mockData.rulesConfigRows = [];

    render(<PlannerPage />);

    await waitFor(() => {
      expect(mockData.rulesConfigRows.length).toBeGreaterThanOrEqual(6);
    });
  });

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

  it("shows a rule warning when fish is planned before an office day", async () => {
    const today = new Date();
    const monday = new Date(today);
    const daysFromMonday = (monday.getDay() + 6) % 7;
    monday.setDate(monday.getDate() - daysFromMonday);

    const dateKey = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;

    mockData.mealPlanRows = [
      {
        id: "fish-row",
        date: dateKey,
        main_dish_id: "dish-fish",
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
      expect(screen.getByText(/No fish before office days/i)).toBeInTheDocument();
    });
  });

  it("auto-suggests meals for unlocked days", async () => {
    mockData.mealPlanRows = [] as MealPlanRow[];

    render(<PlannerPage />);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "+ Add meal" }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole("button", { name: "Auto-Suggest All" }));

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Change" }).length).toBeGreaterThan(0);
    });
  });

  it("auto-suggests meals only for selected days", async () => {
    mockData.mealPlanRows = [] as MealPlanRow[];

    render(<PlannerPage />);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "+ Add meal" }).length).toBe(14);
    });

    const selectionCheckboxes = screen.getAllByRole("checkbox", { name: /Select /i });
    fireEvent.click(selectionCheckboxes[0]);
    fireEvent.click(screen.getByRole("button", { name: "Auto-Suggest Selected" }));

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "+ Add meal" }).length).toBe(13);
    });
  });

  it("renders 7 days when planning horizon is set to 7", async () => {
    mockData.userSettings = {
      ...mockData.userSettings,
      planning_horizon_days: 7,
    };
    mockData.mealPlanRows = [] as MealPlanRow[];

    render(<PlannerPage />);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "+ Add meal" }).length).toBe(7);
    });
  });

  it("auto-suggest all respects locked days", async () => {
    const mondayKey = getMondayDateKey();

    mockData.mealPlanRows = [
      {
        id: "locked-day",
        date: mondayKey,
        main_dish_id: null,
        main_dish_type: null,
        side_dish_ids: [],
        dessert_dish_id: null,
        has_guests: false,
        person_a_office_next_day: true,
        person_b_office_next_day: true,
        locked: true,
        is_blocked: false,
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ] as MealPlanRow[];

    render(<PlannerPage />);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "+ Add meal" }).length).toBe(14);
    });

    fireEvent.click(screen.getByRole("button", { name: "Auto-Suggest All" }));

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "+ Add meal" }).length).toBe(1);
    });
  });

  it("shows feedback when no enabled main dishes are available", async () => {
    mockData.mealPlanRows = [] as MealPlanRow[];
    mockData.dishes = [
      {
        id: "dish-manual",
        name: "Manual Main",
        course: ["main"],
        proteins: ["chicken"],
        isSpicy: false,
        time: "low",
        keyIngredients: ["chicken"],
        status: "manual_only",
      },
      {
        id: "dish-disabled",
        name: "Disabled Main",
        course: ["main"],
        proteins: ["fish"],
        isSpicy: false,
        time: "low",
        keyIngredients: ["fish"],
        status: "disabled",
      },
    ];

    render(<PlannerPage />);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "+ Add meal" }).length).toBe(14);
    });

    fireEvent.click(screen.getByRole("button", { name: "Auto-Suggest All" }));

    await waitFor(() => {
      expect(screen.getByText("No enabled main dishes available")).toBeInTheDocument();
    });
  });

  it("clears only non-locked planned meals with Clear", async () => {
    const today = new Date();
    const monday = new Date(today);
    const daysFromMonday = (monday.getDay() + 6) % 7;
    monday.setDate(monday.getDate() - daysFromMonday);

    const mondayKey = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
    const tuesday = new Date(monday);
    tuesday.setDate(tuesday.getDate() + 1);
    const tuesdayKey = `${tuesday.getFullYear()}-${String(tuesday.getMonth() + 1).padStart(2, "0")}-${String(tuesday.getDate()).padStart(2, "0")}`;

    mockData.mealPlanRows = [
      {
        id: "clear-unlocked",
        date: mondayKey,
        main_dish_id: "dish-1",
        main_dish_type: "dish",
        side_dish_ids: [],
        dessert_dish_id: null,
        has_guests: false,
        person_a_office_next_day: false,
        person_b_office_next_day: false,
        locked: false,
        is_blocked: false,
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "clear-locked",
        date: tuesdayKey,
        main_dish_id: "dish-1",
        main_dish_type: "dish",
        side_dish_ids: [],
        dessert_dish_id: null,
        has_guests: false,
        person_a_office_next_day: false,
        person_b_office_next_day: false,
        locked: true,
        is_blocked: false,
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ] as MealPlanRow[];

    render(<PlannerPage />);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Change" }).length).toBe(2);
    });

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Change" }).length).toBe(1);
    });
  });

  it("clears all planned meals with Clear All", async () => {
    const today = new Date();
    const monday = new Date(today);
    const daysFromMonday = (monday.getDay() + 6) % 7;
    monday.setDate(monday.getDate() - daysFromMonday);

    const mondayKey = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
    const tuesday = new Date(monday);
    tuesday.setDate(tuesday.getDate() + 1);
    const tuesdayKey = `${tuesday.getFullYear()}-${String(tuesday.getMonth() + 1).padStart(2, "0")}-${String(tuesday.getDate()).padStart(2, "0")}`;

    mockData.mealPlanRows = [
      {
        id: "clear-all-1",
        date: mondayKey,
        main_dish_id: "dish-1",
        main_dish_type: "dish",
        side_dish_ids: [],
        dessert_dish_id: null,
        has_guests: false,
        person_a_office_next_day: false,
        person_b_office_next_day: false,
        locked: false,
        is_blocked: false,
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "clear-all-2",
        date: tuesdayKey,
        main_dish_id: "dish-1",
        main_dish_type: "dish",
        side_dish_ids: [],
        dessert_dish_id: null,
        has_guests: false,
        person_a_office_next_day: false,
        person_b_office_next_day: false,
        locked: true,
        is_blocked: false,
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ] as MealPlanRow[];

    render(<PlannerPage />);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Change" }).length).toBe(2);
    });

    fireEvent.click(screen.getByRole("button", { name: "Clear All" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Change" })).not.toBeInTheDocument();
    });
  });

  it("opens Day Edit modal from day menu and saves", async () => {
    mockData.mealPlanRows = [] as MealPlanRow[];

    render(<PlannerPage />);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /Open actions for/i }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole("button", { name: /Open actions for/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Edit day details" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Edit day details for/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Save day" }));

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: /Edit day details for/i })).not.toBeInTheDocument();
    });
  });

  it("shows inline score metadata in Edit Meal main options and no Swap button", async () => {
    const dateKey = getMondayDateKey();

    mockData.mealPlanRows = [
      {
        id: "swap-row",
        date: dateKey,
        main_dish_id: "dish-fish",
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
      expect(screen.getByText("Main: Salmon")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Swap" })).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Change" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Edit meal for/i })).toBeInTheDocument();
      expect(screen.getByText(/Score 100/i)).toBeInTheDocument();
      expect(screen.queryByText("Day details")).not.toBeInTheDocument();
    });
  });
});
