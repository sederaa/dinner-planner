import { useState, useEffect } from "react";
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
}

const COURSE_TYPES: CourseType[] = ["main", "side", "dessert"];
const DISH_TIMES: DishTime[] = ["low", "medium", "high"];
const DISH_STATUSES: DishStatus[] = ["enabled", "manual_only", "disabled"];

export function DishFormDialog({ open, onClose, onSubmit, dish }: DishFormDialogProps) {
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
    if (proteinInput.trim() && !formData.proteins.includes(proteinInput.trim())) {
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

  const addIngredient = () => {
    if (ingredientInput.trim() && !formData.keyIngredients.includes(ingredientInput.trim())) {
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dish ? "Edit Dish" : "Add New Dish"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div className="space-y-2">
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
          <div className="space-y-2">
            <Label>Course * (select at least one)</Label>
            <div className="flex gap-4">
              {COURSE_TYPES.map((course) => (
                <div key={course} className="flex items-center space-x-2">
                  <Checkbox id={`course-${course}`} checked={formData.course.includes(course)} onCheckedChange={() => toggleCourse(course)} />
                  <label htmlFor={`course-${course}`} className="text-sm capitalize cursor-pointer">
                    {course}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Proteins */}
          <div className="space-y-2">
            <Label htmlFor="protein">Proteins (leave empty for vegetarian)</Label>
            <div className="flex gap-2">
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
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.proteins.map((protein) => (
                <span key={protein} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                  {protein}
                  <button type="button" onClick={() => removeProtein(protein)} className="hover:text-blue-900">
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Key Ingredients */}
          <div className="space-y-2">
            <Label htmlFor="ingredient">Key Ingredients *</Label>
            <div className="flex gap-2">
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
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.keyIngredients.map((ingredient) => (
                <span key={ingredient} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
                  {ingredient}
                  <button type="button" onClick={() => removeIngredient(ingredient)} className="hover:text-green-900">
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Time & Spicy */}
          <div className={`grid gap-4 ${dish ? "grid-cols-2" : "grid-cols-1"}`}>
            <div className="space-y-2">
              <Label htmlFor="time">Time & Difficulty *</Label>
              <Select value={formData.time} onValueChange={(value: DishTime) => setFormData({ ...formData, time: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DISH_TIMES.map((time) => (
                    <SelectItem key={time} value={time} className="capitalize">
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {dish && (
              <div className="space-y-2">
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
          <div className="flex items-center space-x-2">
            <Checkbox id="isSpicy" checked={formData.isSpicy} onCheckedChange={(checked) => setFormData({ ...formData, isSpicy: checked === true })} />
            <label htmlFor="isSpicy" className="text-sm cursor-pointer">
              🌶️ This dish is spicy
            </label>
          </div>

          {/* Notes */}
          <div className="space-y-2">
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
          <div className="flex justify-end gap-3 pt-4">
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
