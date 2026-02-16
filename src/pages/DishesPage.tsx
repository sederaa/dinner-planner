import { useMemo, useState } from "react";
import { useDishes } from "../hooks/useDishes";
import { DishList } from "../components/DishList";
import { DishFormDialog } from "../components/DishFormDialog";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import type { Dish, DishFormData, CourseType, DishStatus, DishTime } from "../types/dish";

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
  const [selectedCourses, setSelectedCourses] = useState<CourseType[]>([]);
  const [selectedProteins, setSelectedProteins] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState<DishTime | "all">("all");
  const [selectedStatus, setSelectedStatus] = useState<DishStatus | "all">("all");
  const [spicyOnly, setSpicyOnly] = useState(false);

  const allProteins = useMemo(() => {
    const set = new Set<string>();
    dishes.forEach((d) => d.proteins?.forEach((p) => p && set.add(p)));
    return Array.from(set).sort();
  }, [dishes]);

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
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">🍽️ Dishes</h2>
          <p className="text-gray-600">Manage your dish database</p>
        </div>
        <Button onClick={handleAddClick} size="lg">
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
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
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

              <div className="flex items-center gap-2">
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

              <div className="flex items-center gap-2">
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

              <Button type="button" variant="link" className="ml-2 h-auto p-0" onClick={clearFilters}>
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
