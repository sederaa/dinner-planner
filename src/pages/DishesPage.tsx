import { useEffect, useMemo, useState } from "react";
import { useDishes } from "../hooks/useDishes";
import { DishList } from "../components/DishList";
import { DishFormDialog } from "../components/DishFormDialog";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { Card, CardContent } from "../components/ui/card";
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

  const toggleProtein = (protein: string) => {
    setSelectedProteins((prev) => (prev.includes(protein) ? prev.filter((value) => value !== protein) : [...prev, protein]));
  };

  const clearFilters = () => {
    setSelectedCourses([]);
    setSelectedProteins([]);
    setSelectedTime("all");
    setSelectedStatus("all");
    setSpicyOnly(false);
  };

  const filteredDishes = useMemo(() => {
    return dishes.filter((dish) => {
      if (selectedCourses.length > 0 && !dish.course.some((course) => selectedCourses.includes(course))) return false;
      if (selectedProteins.length > 0) {
        const hasAny = dish.proteins && dish.proteins.some((protein) => selectedProteins.includes(protein));
        if (!hasAny) return false;
      }
      if (selectedTime !== "all" && dish.time !== selectedTime) return false;
      if (selectedStatus !== "all" && dish.status !== selectedStatus) return false;
      if (spicyOnly && !dish.isSpicy) return false;
      return true;
    });
  }, [dishes, selectedCourses, selectedProteins, selectedTime, selectedStatus, spicyOnly]);

  return (
    <div className="page-root">
      <Card className="surface-panel">
        <CardContent className="page-header-row">
          <div>
            <h2 className="page-title">Dish Catalog</h2>
            <p className="page-subtitle">Manage your library and control what appears in planning.</p>
          </div>
          <Button onClick={handleAddClick} className="action-button">
            + Add Dish
          </Button>
        </CardContent>
      </Card>

      {loading && (
        <Card className="surface-panel">
          <CardContent className="state-message">Loading dishes...</CardContent>
        </Card>
      )}

      {error && (
        <Card className="surface-panel state-error">
          <CardContent>{error}</CardContent>
        </Card>
      )}

      {!loading && !error && (
        <div className="page-stack">
          <Card className="surface-panel">
            <CardContent className="filter-panel">
              <div className="filter-row">
                <div className="filter-label">Course:</div>
                <label className="chip-toggle">
                  <Checkbox checked={selectedCourses.includes("main")} onCheckedChange={() => toggleCourse("main")} />
                  Main
                </label>
                <label className="chip-toggle">
                  <Checkbox checked={selectedCourses.includes("side")} onCheckedChange={() => toggleCourse("side")} />
                  Side
                </label>
                <label className="chip-toggle">
                  <Checkbox checked={selectedCourses.includes("dessert")} onCheckedChange={() => toggleCourse("dessert")} />
                  Dessert
                </label>
              </div>

              <div className="filter-row filter-row-controls">
                <div className="filter-group">
                  <div className="filter-label">Proteins:</div>
                  <div className="chip-wrap">
                    {allProteins.length === 0 && <div className="empty-inline">—</div>}
                    {allProteins.map((protein) => (
                      <label key={protein} className="chip-toggle">
                        <Checkbox checked={selectedProteins.includes(protein)} onCheckedChange={() => toggleProtein(protein)} />
                        {protein}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="filter-group filter-group-inline">
                  <div className="filter-label">Time:</div>
                  <Select value={selectedTime} onValueChange={(value: DishTime | "all") => setSelectedTime(value)}>
                    <SelectTrigger className="input-xs">
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

                <div className="filter-group filter-group-inline">
                  <div className="filter-label">Status:</div>
                  <Select value={selectedStatus} onValueChange={(value: DishStatus | "all") => setSelectedStatus(value)}>
                    <SelectTrigger className="input-md">
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

                <label className="chip-toggle">
                  <Checkbox checked={spicyOnly} onCheckedChange={(checked) => setSpicyOnly(checked === true)} />
                  Spicy only
                </label>

                <Button type="button" variant="link" onClick={clearFilters}>
                  Clear filters
                </Button>
              </div>
            </CardContent>
          </Card>

          <DishList dishes={filteredDishes} onEdit={handleEditClick} onDelete={handleDeleteClick} />
        </div>
      )}

      <DishFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        dish={editingDish}
        existingDishes={dishes}
      />
    </div>
  );
}
