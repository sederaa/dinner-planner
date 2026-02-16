import { useMemo, useState } from "react";
import { useDishes } from "../hooks/useDishes";
import { DishList } from "../components/DishList";
import { DishFormDialog } from "../components/DishFormDialog";
import type { Dish, DishFormData, DishType } from "../types/dish";

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
  const [selectedTypes, setSelectedTypes] = useState<DishType[]>([]);
  const [selectedProteins, setSelectedProteins] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [spicyOnly, setSpicyOnly] = useState(false);

  const allProteins = useMemo(() => {
    const set = new Set<string>();
    dishes.forEach((d) => d.proteins?.forEach((p) => p && set.add(p)));
    return Array.from(set).sort();
  }, [dishes]);

  const toggleType = (t: DishType) => {
    setSelectedTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  const toggleProtein = (p: string) => {
    setSelectedProteins((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  const clearFilters = () => {
    setSelectedTypes([]);
    setSelectedProteins([]);
    setSelectedTime("all");
    setSelectedStatus("");
    setSpicyOnly(false);
  };

  const filteredDishes = useMemo(() => {
    return dishes.filter((d) => {
      if (selectedTypes.length > 0 && !d.type.some((t) => selectedTypes.includes(t))) return false;
      if (selectedProteins.length > 0) {
        const hasAny = d.proteins && d.proteins.some((p) => selectedProteins.includes(p));
        if (!hasAny) return false;
      }
      if (selectedTime !== "all" && (d.time as string) !== selectedTime) return false;
      if (selectedStatus !== "" && d.status !== selectedStatus) return false;
      if (spicyOnly && !d.isSpicy) return false;
      return true;
    });
  }, [dishes, selectedTypes, selectedProteins, selectedTime, selectedStatus, spicyOnly]);

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">🍽️ Dishes</h2>
          <p className="text-gray-600">Manage your dish database</p>
        </div>
        <button onClick={handleAddClick} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
          + Add Dish
        </button>
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
              <div className="text-sm font-medium text-gray-700 mr-2">Type:</div>
              <label className="inline-flex items-center text-sm">
                <input type="checkbox" checked={selectedTypes.includes("main")} onChange={() => toggleType("main")} className="mr-1" />
                Main
              </label>
              <label className="inline-flex items-center text-sm ml-2">
                <input type="checkbox" checked={selectedTypes.includes("side")} onChange={() => toggleType("side")} className="mr-1" />
                Side
              </label>
              <label className="inline-flex items-center text-sm ml-2">
                <input type="checkbox" checked={selectedTypes.includes("dessert")} onChange={() => toggleType("dessert")} className="mr-1" />
                Dessert
              </label>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="text-sm font-medium text-gray-700">Proteins:</div>
                <div className="flex gap-2 flex-wrap">
                  {allProteins.length === 0 && <div className="text-sm text-gray-500">—</div>}
                  {allProteins.map((p) => (
                    <label key={p} className="inline-flex items-center text-sm">
                      <input type="checkbox" checked={selectedProteins.includes(p)} onChange={() => toggleProtein(p)} className="mr-1" />
                      {p}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="text-sm font-medium text-gray-700">Time:</div>
                <select value={selectedTime} onChange={(e) => setSelectedTime(e.target.value)} className="border rounded px-2 py-1 text-sm">
                  <option value="all">All</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <div className="text-sm font-medium text-gray-700">Status:</div>
                <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className="border rounded px-2 py-1 text-sm">
                  <option value=""></option>
                  <option value="enabled">Enabled</option>
                  <option value="manual_only">Manual only</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>

              <label className="inline-flex items-center text-sm">
                <input type="checkbox" checked={spicyOnly} onChange={() => setSpicyOnly((s) => !s)} className="mr-1" />
                Spicy only
              </label>

              <button onClick={clearFilters} className="ml-2 text-sm text-blue-600 hover:text-blue-800">Clear</button>
            </div>
          </div>

          <DishList dishes={filteredDishes} onEdit={handleEditClick} onDelete={handleDeleteClick} />
        </div>
      )}

      <DishFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onSubmit={handleSubmit} dish={editingDish} />
    </div>
  );
}
