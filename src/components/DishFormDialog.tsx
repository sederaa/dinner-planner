import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Checkbox } from "./ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import type { Dish, DishFormData, CourseType, DishTime, DishStatus } from "../types/dish";

interface DishFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: DishFormData) => Promise<void>;
  dish?: Dish | null;
  existingDishes?: Dish[];
}

const COURSE_TYPES: CourseType[] = ["main", "side", "dessert"];
const DISH_TIMES: DishTime[] = ["low", "medium", "high"];
const DISH_STATUSES: DishStatus[] = ["enabled", "manual_only", "disabled"];

const normalizeValue = (value: string) => value.trim().toLowerCase();

const includesNormalized = (values: string[], candidate: string) => {
  const normalizedCandidate = normalizeValue(candidate);
  return values.some((value) => normalizeValue(value) === normalizedCandidate);
};

const getMostCommonValues = (values: string[]): string[] => {
  const counts = new Map<string, { label: string; count: number }>();

  values.forEach((value) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    const normalized = normalizeValue(trimmed);
    const current = counts.get(normalized);
    if (current) {
      counts.set(normalized, { ...current, count: current.count + 1 });
      return;
    }

    counts.set(normalized, { label: trimmed, count: 1 });
  });

  return Array.from(counts.values())
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.label.localeCompare(b.label);
    })
    .slice(0, 10)
    .map((item) => item.label);
};

export function DishFormDialog({ open, onClose, onSubmit, dish, existingDishes = [] }: DishFormDialogProps) {
  const [formData, setFormData] = useState<DishFormData>({
    name: "",
    course: [],
    proteins: [],
    isSpicy: false,
    time: "medium",
    keyIngredients: [],
    status: "enabled",
    type: "cooked",
    notes: "",
    tags: [],
  });
  const [proteinInput, setProteinInput] = useState("");
  const [ingredientInput, setIngredientInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const commonProteinSuggestions = useMemo(() => {
    const proteins = existingDishes.flatMap((existingDish) => existingDish.proteins || []);
    return getMostCommonValues(proteins).filter((protein) => !includesNormalized(formData.proteins, protein));
  }, [existingDishes, formData.proteins]);

  const commonIngredientSuggestions = useMemo(() => {
    const ingredients = existingDishes.flatMap((existingDish) => existingDish.keyIngredients || []);
    return getMostCommonValues(ingredients).filter((ingredient) => !includesNormalized(formData.keyIngredients, ingredient));
  }, [existingDishes, formData.keyIngredients]);

  useEffect(() => {
    if (dish) {
      setFormData({
        name: dish.name,
        course: dish.course,
        proteins: dish.proteins || [],
        isSpicy: dish.isSpicy,
        time: dish.time,
        keyIngredients: dish.keyIngredients,
        status: dish.status,
        type: dish.type || "cooked",
        notes: dish.notes || "",
        tags: dish.tags || [],
      });
    } else {
      setFormData({
        name: "",
        course: [],
        proteins: [],
        isSpicy: false,
        time: "medium",
        keyIngredients: [],
        status: "enabled",
        type: "cooked",
        notes: "",
        tags: [],
      });
    }
    setProteinInput("");
    setIngredientInput("");
  }, [dish, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (error) {
      console.error("Error submitting form:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleCourse = (course: CourseType) => {
    setFormData((prev) => ({
      ...prev,
      course: prev.course.includes(course) ? prev.course.filter((c) => c !== course) : [...prev.course, course],
    }));
  };

  const addProtein = () => {
    if (proteinInput.trim() && !includesNormalized(formData.proteins, proteinInput.trim())) {
      setFormData((prev) => ({
        ...prev,
        proteins: [...prev.proteins, proteinInput.trim()],
      }));
      setProteinInput("");
    }
  };

  const removeProtein = (protein: string) => {
    setFormData((prev) => ({
      ...prev,
      proteins: prev.proteins.filter((p) => p !== protein),
    }));
  };

  const addSuggestedProtein = (protein: string) => {
    if (!includesNormalized(formData.proteins, protein)) {
      setFormData((prev) => ({
        ...prev,
        proteins: [...prev.proteins, protein],
      }));
    }
  };

  const addIngredient = () => {
    if (ingredientInput.trim() && !includesNormalized(formData.keyIngredients, ingredientInput.trim())) {
      setFormData((prev) => ({
        ...prev,
        keyIngredients: [...prev.keyIngredients, ingredientInput.trim()],
      }));
      setIngredientInput("");
    }
  };

  const removeIngredient = (ingredient: string) => {
    setFormData((prev) => ({
      ...prev,
      keyIngredients: prev.keyIngredients.filter((i) => i !== ingredient),
    }));
  };

  const addSuggestedIngredient = (ingredient: string) => {
    if (!includesNormalized(formData.keyIngredients, ingredient)) {
      setFormData((prev) => ({
        ...prev,
        keyIngredients: [...prev.keyIngredients, ingredient],
      }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="dish-dialog">
        <DialogHeader>
          <DialogTitle>{dish ? "Edit Dish" : "Add New Dish"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="form-stack">
          {/* Name */}
          <div className="form-section">
            <Label htmlFor="name">Dish Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="e.g., Baked Chicken"
            />
          </div>

          {/* Course */}
          <div className="form-section">
            <Label>Course * (select at least one)</Label>
            <div className="inline-group">
              {COURSE_TYPES.map((course) => (
                <div key={course} className="inline-group-item">
                  <Checkbox id={`course-${course}`} checked={formData.course.includes(course)} onCheckedChange={() => toggleCourse(course)} />
                  <label htmlFor={`course-${course}`} className="form-inline-label">
                    {course}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Proteins */}
          <div className="form-section">
            <Label htmlFor="protein">Proteins (leave empty for vegetarian)</Label>
            <div className="inline-group">
              <Input
                id="protein"
                value={proteinInput}
                onChange={(e) => setProteinInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addProtein())}
                placeholder="e.g., chicken, fish"
              />
              <Button type="button" onClick={addProtein}>
                Add
              </Button>
              {commonProteinSuggestions.map((protein) => (
                <Button
                  key={protein}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="quick-add-suggestion"
                  onClick={() => addSuggestedProtein(protein)}
                >
                  + {protein}
                </Button>
              ))}
            </div>
            <div className="chip-wrap">
              {formData.proteins.map((protein) => (
                <span key={protein} className="badge">
                  {protein}
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeProtein(protein)}>
                    ×
                  </Button>
                </span>
              ))}
            </div>
          </div>

          {/* Key Ingredients */}
          <div className="form-section">
            <Label htmlFor="ingredient">Key Ingredients *</Label>
            <div className="inline-group">
              <Input
                id="ingredient"
                value={ingredientInput}
                onChange={(e) => setIngredientInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addIngredient())}
                placeholder="e.g., tomatoes, garlic"
              />
              <Button type="button" onClick={addIngredient}>
                Add
              </Button>
              {commonIngredientSuggestions.map((ingredient) => (
                <Button
                  key={ingredient}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="quick-add-suggestion"
                  onClick={() => addSuggestedIngredient(ingredient)}
                >
                  + {ingredient}
                </Button>
              ))}
            </div>
            <div className="chip-wrap">
              {formData.keyIngredients.map((ingredient) => (
                <span key={ingredient} className="badge">
                  {ingredient}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeIngredient(ingredient)}
                  >
                    ×
                  </Button>
                </span>
              ))}
            </div>
          </div>

          {/* Time & Spicy */}
          <div className={dish ? "form-grid-two" : "form-grid-one"}>
            <div className="form-section">
              <Label htmlFor="time">Time & Difficulty *</Label>
              <Select value={formData.time} onValueChange={(value: DishTime) => setFormData({ ...formData, time: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DISH_TIMES.map((time) => (
                    <SelectItem key={time} value={time}>
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {dish && (
              <div className="form-section">
                <Label htmlFor="status">Status *</Label>
                <Select value={formData.status} onValueChange={(value: DishStatus) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DISH_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Spicy checkbox */}
          <div className="inline-group-item">
            <Checkbox id="isSpicy" checked={formData.isSpicy} onCheckedChange={(checked) => setFormData({ ...formData, isSpicy: checked === true })} />
            <label htmlFor="isSpicy" className="form-inline-label">
              🌶️ This dish is spicy
            </label>
          </div>

          {/* Notes */}
          <div className="form-section">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any additional notes or cooking tips..."
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="form-actions">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || formData.course.length === 0 || formData.keyIngredients.length === 0}>
              {submitting ? "Saving..." : dish ? "Update Dish" : "Add Dish"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
