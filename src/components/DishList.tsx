import { useEffect, useMemo, useState } from "react";
import type { Dish, DishStatus } from "../types/dish";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";

interface DishListProps {
  dishes: Dish[];
  onEdit: (dish: Dish) => void;
  onDelete: (dish: Dish) => void;
}

type SortColumn = "name" | "type" | "proteins" | "time" | "status";
type SortDirection = "asc" | "desc";

export function DishList({ dishes, onEdit, onDelete }: DishListProps) {
  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const [sortColumn, setSortColumn] = useState<SortColumn>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

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
      <Card className="surface-panel">
        <CardContent className="state-message">
        <div>
          <div>🍽️</div>
          <h3 className="section-title">No dishes yet</h3>
          <p className="state-info">Get started by adding your first dish</p>
        </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      enabled: "badge badge-primary",
      manual_only: "badge",
      disabled: "badge badge-muted",
    };
    return styles[status as keyof typeof styles] || styles.enabled;
  };

  const getTimeBadge = (time: string) => {
    const styles = {
      low: "badge badge-success",
      medium: "badge",
      high: "badge badge-danger",
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

  const sortedDishes = useMemo(() => {
    const timeOrder: Record<Dish["time"], number> = {
      low: 0,
      medium: 1,
      high: 2,
    };

    const statusOrder: Record<DishStatus, number> = {
      enabled: 0,
      manual_only: 1,
      disabled: 2,
    };

    const getCourseLabel = (dish: Dish) => [...dish.course].sort().join(", ");
    const getProteinLabel = (dish: Dish) => (dish.proteins && dish.proteins.length > 0 ? dish.proteins.join(", ") : "");

    const sorted = [...dishes].sort((a, b) => {
      let comparison = 0;

      if (sortColumn === "name") {
        comparison = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      }

      if (sortColumn === "type") {
        comparison = getCourseLabel(a).localeCompare(getCourseLabel(b), undefined, { sensitivity: "base" });
      }

      if (sortColumn === "proteins") {
        comparison = getProteinLabel(a).localeCompare(getProteinLabel(b), undefined, { sensitivity: "base" });
      }

      if (sortColumn === "time") {
        comparison = timeOrder[a.time] - timeOrder[b.time];
      }

      if (sortColumn === "status") {
        comparison = statusOrder[a.status] - statusOrder[b.status];
      }

      if (comparison === 0) {
        comparison = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      }

      return sortDirection === "asc" ? comparison : comparison * -1;
    });

    return sorted;
  }, [dishes, sortColumn, sortDirection]);

  const handleHeaderSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortColumn(column);
    setSortDirection("asc");
  };

  const sortIndicator = (column: SortColumn) => {
    if (sortColumn !== column) {
      return "↕";
    }

    return sortDirection === "asc" ? "↑" : "↓";
  };

  return (
    <Card className="surface-panel">
      {isMobileLayout ? (
      <div className="table-mobile">
        {sortedDishes.map((dish) => (
          <div key={dish.id} className="table-mobile-row">
            <div className="table-mobile-row-top">
              <div>
                <div className="table-name">{dish.name}</div>
                {dish.isSpicy && <span className="badge badge-danger">🌶️ Spicy</span>}
              </div>
              <span className={getStatusBadge(dish.status)}>
                {getStatusLabel(dish.status)}
              </span>
            </div>

            <div className="chip-wrap">
              {dish.course.map((course) => (
                <span key={course} className="badge">
                  {course}
                </span>
              ))}
              <span className={getTimeBadge(dish.time)}>Time: {dish.time}</span>
            </div>

            <div className="muted-text">
              <span className="font-medium">Proteins:</span> {dish.proteins && dish.proteins.length > 0 ? dish.proteins.join(", ") : "—"}
            </div>

            <div className="inline-actions">
              <Button variant="link" onClick={() => onEdit(dish)}>
                Edit
              </Button>
              <Button variant="link" className="danger-text" onClick={() => onDelete(dish)}>
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
      ) : (
      <div className="table-wrap">
        <table className="app-table">
          <thead>
            <tr>
              <th>
                <Button variant="ghost" onClick={() => handleHeaderSort("name")}>Name {sortIndicator("name")}</Button>
              </th>
              <th>
                <Button variant="ghost" onClick={() => handleHeaderSort("type")}>Type {sortIndicator("type")}</Button>
              </th>
              <th>
                <Button variant="ghost" onClick={() => handleHeaderSort("proteins")}>Proteins {sortIndicator("proteins")}</Button>
              </th>
              <th>
                <Button variant="ghost" onClick={() => handleHeaderSort("time")}>Time {sortIndicator("time")}</Button>
              </th>
              <th>
                <Button variant="ghost" onClick={() => handleHeaderSort("status")}>Status {sortIndicator("status")}</Button>
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedDishes.map((dish) => (
              <tr key={dish.id}>
                <td>
                  <div>
                    <div className="table-name">{dish.name}</div>
                    {dish.isSpicy && <span className="badge badge-danger">🌶️ Spicy</span>}
                  </div>
                </td>
                <td>
                  <div className="chip-wrap">
                    {dish.course.map((course) => (
                      <span key={course} className="badge">
                        {course}
                      </span>
                    ))}
                  </div>
                </td>
                <td>{dish.proteins && dish.proteins.length > 0 ? dish.proteins.join(", ") : "—"}</td>
                <td><span className={getTimeBadge(dish.time)}>{dish.time}</span></td>
                <td><span className={getStatusBadge(dish.status)}>{getStatusLabel(dish.status)}</span></td>
                <td className="actions-cell">
                  <Button variant="link" onClick={() => onEdit(dish)}>
                    Edit
                  </Button>
                  <Button variant="link" className="danger-text" onClick={() => onDelete(dish)}>
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
