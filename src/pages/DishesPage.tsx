export function DishesPage() {
  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">🍽️ Dishes</h2>
          <p className="text-gray-600">Manage your dish database</p>
        </div>
        <button className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg hover:scale-105 transition-all font-medium shadow-md">
          + Add Dish
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="text-6xl mb-4">🥘</div>
          <p className="text-lg text-gray-500 mb-2">Dish list and filters coming soon</p>
          <p className="text-sm text-gray-400">Create, edit, and manage your favorite dishes</p>
        </div>
      </div>
    </div>
  );
}
