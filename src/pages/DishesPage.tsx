export function DishesPage() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dishes</h2>
          <p className="text-gray-600 mt-1">Manage your dish database</p>
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">Add Dish</button>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500">Dish list and filters coming soon...</p>
      </div>
    </div>
  );
}
