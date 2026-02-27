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

  return (
    <Card className="surface-panel">
      {isMobileLayout ? (
      <div className="table-mobile">
        {dishes.map((dish) => (
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
              <th>Name</th>
              <th>Type</th>
              <th>Proteins</th>
              <th>Time</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {dishes.map((dish) => (
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
