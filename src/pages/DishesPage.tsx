import { useState } from "react";
import { useDishes } from "../hooks/useDishes";
import { DishList } from "../components/DishList";
import { DishFormDialog } from "../components/DishFormDialog";
import type { Dish, DishFormData } from "../types/dish";

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

      {!loading && !error && <DishList dishes={dishes} onEdit={handleEditClick} onDelete={handleDeleteClick} />}

      <DishFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onSubmit={handleSubmit} dish={editingDish} />
    </div>
  );
}
