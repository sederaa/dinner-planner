import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DishesPage } from "./DishesPage";

const SESSION_KEY = "dinner-planner:dishes-filters";

const mockDishesState = vi.hoisted(() => ({
  loading: false,
  error: null as string | null,
  dishes: [
    {
      id: "dish-main-spicy",
      name: "Spicy Tacos",
      course: ["main"],
      proteins: ["beef"],
      isSpicy: true,
      time: "low",
      keyIngredients: ["beef"],
      status: "enabled",
    },
    {
      id: "dish-side-mild",
      name: "Green Salad",
      course: ["side"],
      proteins: ["lettuce"],
      isSpicy: false,
      time: "low",
      keyIngredients: ["lettuce"],
      status: "enabled",
    },
  ],
}));

vi.mock("../hooks/useDishes", () => ({
  useDishes: () => ({
    dishes: mockDishesState.dishes,
    loading: mockDishesState.loading,
    error: mockDishesState.error,
    addDish: vi.fn(),
    updateDish: vi.fn(),
    deleteDish: vi.fn(),
  }),
}));

describe("DishesPage filter persistence", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    mockDishesState.loading = false;
    mockDishesState.error = null;
    mockDishesState.dishes = [
      {
        id: "dish-main-spicy",
        name: "Spicy Tacos",
        course: ["main"],
        proteins: ["beef"],
        isSpicy: true,
        time: "low",
        keyIngredients: ["beef"],
        status: "enabled",
      },
      {
        id: "dish-side-mild",
        name: "Green Salad",
        course: ["side"],
        proteins: ["lettuce"],
        isSpicy: false,
        time: "low",
        keyIngredients: ["lettuce"],
        status: "enabled",
      },
    ];
  });

  it("persists filters to session storage when changed", async () => {
    render(<DishesPage />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Main" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Spicy only" }));

    await waitFor(() => {
      const raw = window.sessionStorage.getItem(SESSION_KEY);
      expect(raw).toBeTruthy();

      const parsed = JSON.parse(raw as string) as {
        selectedCourses: string[];
        spicyOnly: boolean;
      };

      expect(parsed.selectedCourses).toEqual(["main"]);
      expect(parsed.spicyOnly).toBe(true);
    });
  });

  it("restores filters from session storage on load", async () => {
    window.sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        selectedCourses: ["main"],
        selectedProteins: [],
        selectedTime: "all",
        selectedStatus: "all",
        spicyOnly: true,
      })
    );

    render(<DishesPage />);

    await waitFor(() => {
      expect(screen.getByRole("checkbox", { name: "Main" })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: "Spicy only" })).toBeChecked();
      expect(screen.getAllByText("Spicy Tacos").length).toBeGreaterThan(0);
      expect(screen.queryByText("Green Salad")).not.toBeInTheDocument();
    });
  });

  it("keeps persisted protein filters across loading-to-loaded transition", async () => {
    window.sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        selectedCourses: [],
        selectedProteins: ["beef"],
        selectedTime: "all",
        selectedStatus: "all",
        spicyOnly: false,
      })
    );

    mockDishesState.loading = true;
    mockDishesState.dishes = [];

    const { rerender } = render(<DishesPage />);

    mockDishesState.loading = false;
    mockDishesState.dishes = [
      {
        id: "dish-main-spicy",
        name: "Spicy Tacos",
        course: ["main"],
        proteins: ["beef"],
        isSpicy: true,
        time: "low",
        keyIngredients: ["beef"],
        status: "enabled",
      },
    ];

    rerender(<DishesPage />);

    await waitFor(() => {
      expect(screen.getByRole("checkbox", { name: "beef" })).toBeChecked();
    });
  });
});
