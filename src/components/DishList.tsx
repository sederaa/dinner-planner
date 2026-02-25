import { useEffect, useState } from "react";
import type { Dish, DishStatus } from "../types/dish";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";

interface DishListProps {
  dishes: Dish[];
  onEdit: (dish: Dish) => void;
  onDelete: (dish: Dish) => void;
}

export function DishList({ dishes, onEdit, onDelete }: DishListProps) {
  const [isMobileLayout, setIsMobileLayout] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobileLayout(mediaQuery.matches);

    update();
    mediaQuery.addEventListener("change", update);

    return () => {
      mediaQuery.removeEventListener("change", update);
    };
  }, []);

  if (dishes.length === 0) {
    return (
      <Card className="rounded-lg border-gray-200">
        <CardContent className="p-12">
        <div className="text-center">
          <div className="text-5xl mb-4">🍽️</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No dishes yet</h3>
          <p className="text-gray-600">Get started by adding your first dish</p>
        </div>
        </CardContent>
      </Card>
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
    <Card className="rounded-lg border-gray-200 overflow-hidden">
      {isMobileLayout ? (
      <div className="divide-y divide-gray-200">
        {dishes.map((dish) => (
          <div key={dish.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-gray-900">{dish.name}</div>
                {dish.isSpicy && <span className="text-xs text-red-600">🌶️ Spicy</span>}
              </div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusBadge(dish.status)}`}>
                {getStatusLabel(dish.status)}
              </span>
            </div>

            <div className="flex flex-wrap gap-1">
              {dish.course.map((course) => (
                <span key={course} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                  {course}
                </span>
              ))}
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getTimeBadge(dish.time)}`}>{dish.time}</span>
            </div>

            <div className="text-xs text-gray-700">
              <span className="font-medium">Proteins:</span> {dish.proteins && dish.proteins.length > 0 ? dish.proteins.join(", ") : "—"}
            </div>

            <div className="flex items-center gap-4">
              <Button variant="link" className="h-auto p-0 text-blue-600 hover:text-blue-900" onClick={() => onEdit(dish)}>
                Edit
              </Button>
              <Button variant="link" className="h-auto p-0 text-red-600 hover:text-red-900" onClick={() => onDelete(dish)}>
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
      ) : (
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
                    {dish.course.map((course) => (
                      <span key={course} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        {course}
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
                  <Button variant="link" className="mr-4 h-auto p-0 text-blue-600 hover:text-blue-900" onClick={() => onEdit(dish)}>
                    Edit
                  </Button>
                  <Button variant="link" className="h-auto p-0 text-red-600 hover:text-red-900" onClick={() => onDelete(dish)}>
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </Card>
  );
}
