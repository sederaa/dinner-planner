import { useEffect, useMemo, useState } from "react";
import { useDishes } from "../hooks/useDishes";
import { DishList } from "../components/DishList";
import { DishFormDialog } from "../components/DishFormDialog";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import type { Dish, DishFormData, CourseType, DishStatus, DishTime } from "../types/dish";

const DISHES_FILTERS_SESSION_KEY = "dinner-planner:dishes-filters";
const ALLOWED_COURSES: CourseType[] = ["main", "side", "dessert"];
const ALLOWED_TIMES: Array<DishTime | "all"> = ["all", "low", "medium", "high"];
const ALLOWED_STATUSES: Array<DishStatus | "all"> = ["all", "enabled", "manual_only", "disabled"];

type PersistedDishesFilters = {
  selectedCourses: CourseType[];
  selectedProteins: string[];
  selectedTime: DishTime | "all";
  selectedStatus: DishStatus | "all";
  spicyOnly: boolean;
};

const DEFAULT_FILTERS: PersistedDishesFilters = {
  selectedCourses: [],
  selectedProteins: [],
  selectedTime: "all",
  selectedStatus: "all",
  spicyOnly: false,
};

const loadPersistedFilters = (): PersistedDishesFilters => {
  if (typeof window === "undefined") {
    return DEFAULT_FILTERS;
  }

  try {
    const raw = window.sessionStorage.getItem(DISHES_FILTERS_SESSION_KEY);
    if (!raw) {
      return DEFAULT_FILTERS;
    }

    const parsed = JSON.parse(raw) as Partial<PersistedDishesFilters>;

    const selectedCourses = Array.isArray(parsed.selectedCourses)
      ? parsed.selectedCourses.filter((value): value is CourseType => ALLOWED_COURSES.includes(value as CourseType))
      : [];

    const selectedProteins = Array.isArray(parsed.selectedProteins)
      ? parsed.selectedProteins.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : [];

    const selectedTime = ALLOWED_TIMES.includes(parsed.selectedTime as DishTime | "all") ? (parsed.selectedTime as DishTime | "all") : "all";
    const selectedStatus = ALLOWED_STATUSES.includes(parsed.selectedStatus as DishStatus | "all") ? (parsed.selectedStatus as DishStatus | "all") : "all";

    return {
      selectedCourses,
      selectedProteins,
      selectedTime,
      selectedStatus,
      spicyOnly: parsed.spicyOnly === true,
    };
  } catch {
    return DEFAULT_FILTERS;
  }
};

export function DishesPage() {
  const { dishes, loading, error, addDish, updateDish, deleteDish } = useDishes();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDish, setEditingDish] = useState<Dish | null>(null);

  const handleAddClick = () => {
    setEditingDish(null);
    setDialogOpen(true);
  };

  const handleEditClick = (dish: Dish) => {
    setEditingDish(dish);
    setDialogOpen(true);
  };

  const handleDeleteClick = async (dish: Dish) => {
    if (window.confirm(`Are you sure you want to delete "${dish.name}"?`)) {
      await deleteDish(dish.id);
    }
  };

  const handleSubmit = async (data: DishFormData) => {
    if (editingDish) {
      await updateDish(editingDish.id, data);
    } else {
      await addDish(data);
    }
  };

  // Filters state
  const initialFilters = useMemo(() => loadPersistedFilters(), []);
  const [selectedCourses, setSelectedCourses] = useState<CourseType[]>(initialFilters.selectedCourses);
  const [selectedProteins, setSelectedProteins] = useState<string[]>(initialFilters.selectedProteins);
  const [selectedTime, setSelectedTime] = useState<DishTime | "all">(initialFilters.selectedTime);
  const [selectedStatus, setSelectedStatus] = useState<DishStatus | "all">(initialFilters.selectedStatus);
  const [spicyOnly, setSpicyOnly] = useState(initialFilters.spicyOnly);

  const allProteins = useMemo(() => {
    const set = new Set<string>();
    dishes.forEach((d) => d.proteins?.forEach((p) => p && set.add(p)));
    return Array.from(set).sort();
  }, [dishes]);

  useEffect(() => {
    if (loading) {
      return;
    }

    setSelectedProteins((current) => current.filter((protein) => allProteins.includes(protein)));
  }, [allProteins, loading]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const payload: PersistedDishesFilters = {
      selectedCourses,
      selectedProteins,
      selectedTime,
      selectedStatus,
      spicyOnly,
    };

    window.sessionStorage.setItem(DISHES_FILTERS_SESSION_KEY, JSON.stringify(payload));
  }, [selectedCourses, selectedProteins, selectedTime, selectedStatus, spicyOnly]);

  const toggleCourse = (course: CourseType) => {
    setSelectedCourses((prev) => (prev.includes(course) ? prev.filter((value) => value !== course) : [...prev, course]));
  };

  const toggleProtein = (p: string) => {
    setSelectedProteins((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  const clearFilters = () => {
    setSelectedCourses([]);
    setSelectedProteins([]);
    setSelectedTime("all");
    setSelectedStatus("all");
    setSpicyOnly(false);
  };

  const filteredDishes = useMemo(() => {
    return dishes.filter((d) => {
      if (selectedCourses.length > 0 && !d.course.some((course) => selectedCourses.includes(course))) return false;
      if (selectedProteins.length > 0) {
        const hasAny = d.proteins && d.proteins.some((p) => selectedProteins.includes(p));
        if (!hasAny) return false;
      }
      if (selectedTime !== "all" && d.time !== selectedTime) return false;
      if (selectedStatus !== "all" && d.status !== selectedStatus) return false;
      if (spicyOnly && !d.isSpicy) return false;
      return true;
    });
  }, [dishes, selectedCourses, selectedProteins, selectedTime, selectedStatus, spicyOnly]);

  return (
    <div>
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">🍽️ Dishes</h2>
          <p className="text-gray-600">Manage your dish database</p>
        </div>
        <Button onClick={handleAddClick} size="lg" className="w-full sm:w-auto">
          + Add Dish
        </Button>
      </div>

      {loading && (
        <div className="text-center py-12">
          <p className="text-gray-600">Loading dishes...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <div>
          <div className="mb-4 flex flex-col gap-3">
            <div className="flex flex-wrap gap-2 items-center">
              <div className="text-sm font-medium text-gray-700 mr-2">Course:</div>
              <label className="inline-flex items-center text-sm gap-2">
                <Checkbox checked={selectedCourses.includes("main")} onCheckedChange={() => toggleCourse("main")} />
                Main
              </label>
              <label className="inline-flex items-center text-sm ml-2 gap-2">
                <Checkbox checked={selectedCourses.includes("side")} onCheckedChange={() => toggleCourse("side")} />
                Side
              </label>
              <label className="inline-flex items-center text-sm ml-2 gap-2">
                <Checkbox checked={selectedCourses.includes("dessert")} onCheckedChange={() => toggleCourse("dessert")} />
                Dessert
              </label>
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm font-medium text-gray-700">Proteins:</div>
                <div className="flex gap-2 flex-wrap">
                  {allProteins.length === 0 && <div className="text-sm text-gray-500">—</div>}
                  {allProteins.map((p) => (
                    <label key={p} className="inline-flex items-center text-sm gap-2">
                      <Checkbox checked={selectedProteins.includes(p)} onCheckedChange={() => toggleProtein(p)} />
                      {p}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm font-medium text-gray-700">Time:</div>
                <Select value={selectedTime} onValueChange={(value: DishTime | "all") => setSelectedTime(value)}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm font-medium text-gray-700">Status:</div>
                <Select value={selectedStatus} onValueChange={(value: DishStatus | "all") => setSelectedStatus(value)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="enabled">Enabled</SelectItem>
                    <SelectItem value="manual_only">Manual only</SelectItem>
                    <SelectItem value="disabled">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <label className="inline-flex items-center text-sm gap-2">
                <Checkbox checked={spicyOnly} onCheckedChange={(checked) => setSpicyOnly(checked === true)} />
                Spicy only
              </label>

              <Button type="button" variant="link" className="h-auto p-0 lg:ml-2" onClick={clearFilters}>
                Clear
              </Button>
            </div>
          </div>

          <DishList dishes={filteredDishes} onEdit={handleEditClick} onDelete={handleDeleteClick} />
        </div>
      )}

      <DishFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onSubmit={handleSubmit} dish={editingDish} />
    </div>
  );
}
