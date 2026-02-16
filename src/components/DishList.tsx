import type { Dish, DishStatus } from "../types/dish";

interface DishListProps {
  dishes: Dish[];
  onEdit: (dish: Dish) => void;
  onDelete: (dish: Dish) => void;
}

export function DishList({ dishes, onEdit, onDelete }: DishListProps) {
  if (dishes.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12">
        <div className="text-center">
          <div className="text-5xl mb-4">🍽️</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No dishes yet</h3>
          <p className="text-gray-600">Get started by adding your first dish</p>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      enabled: "bg-green-100 text-green-800",
      manual_only: "bg-yellow-100 text-yellow-800",
      disabled: "bg-gray-100 text-gray-800",
    };
    return styles[status as keyof typeof styles] || styles.enabled;
  };

  const getTimeBadge = (time: string) => {
    const styles = {
      low: "bg-blue-100 text-blue-800",
      medium: "bg-orange-100 text-orange-800",
      high: "bg-red-100 text-red-800",
    };
    return styles[time as keyof typeof styles] || styles.low;
  };

  const getStatusLabel = (status: DishStatus) => {
    const labels: Record<DishStatus, string> = {
      enabled: "Enabled",
      manual_only: "Manual only",
      disabled: "Disabled",
    };

    return labels[status];
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proteins</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {dishes.map((dish) => (
              <tr key={dish.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{dish.name}</div>
                      {dish.isSpicy && <span className="text-xs text-red-600">🌶️ Spicy</span>}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex gap-1">
                    {dish.type.map((t) => (
                      <span key={t} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        {t}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{dish.proteins && dish.proteins.length > 0 ? dish.proteins.join(", ") : "—"}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getTimeBadge(dish.time)}`}>{dish.time}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusBadge(dish.status)}`}>{getStatusLabel(dish.status)}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button onClick={() => onEdit(dish)} className="text-blue-600 hover:text-blue-900 mr-4">
                    Edit
                  </button>
                  <button onClick={() => onDelete(dish)} className="text-red-600 hover:text-red-900">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
