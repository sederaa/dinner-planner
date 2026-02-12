import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import type { Dish, DishFormData } from "../types/dish";
import type { Database } from "../types/database";

type DishRow = Database["public"]["Tables"]["dishes"]["Row"];
type DishInsert = Database["public"]["Tables"]["dishes"]["Insert"];
type DishUpdate = Database["public"]["Tables"]["dishes"]["Update"];

export function useDishes() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDishes = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase.from("dishes").select("*").order("name");

      if (fetchError) throw fetchError;

      // Convert snake_case DB fields to camelCase app fields
      const dishes: Dish[] = ((data as DishRow[]) || []).map((row) => ({
        id: row.id,
        name: row.name,
        type: row.type as any,
        proteins: row.proteins || undefined,
        isSpicy: row.is_spicy,
        time: row.time as any,
        keyIngredients: row.key_ingredients,
        status: row.status as any,
        notes: row.notes || undefined,
        tags: row.tags || undefined,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      }));

      setDishes(dishes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch dishes");
      console.error("Error fetching dishes:", err);
    } finally {
      setLoading(false);
    }
  };

  const addDish = async (dishData: DishFormData): Promise<Dish | null> => {
    try {
      const insertData: DishInsert = {
        name: dishData.name,
        type: dishData.type,
        proteins: dishData.proteins.length > 0 ? dishData.proteins : null,
        is_spicy: dishData.isSpicy,
        time: dishData.time,
        key_ingredients: dishData.keyIngredients,
        status: dishData.status,
        notes: dishData.notes || null,
        tags: dishData.tags && dishData.tags.length > 0 ? dishData.tags : null,
      };

      const { data, error: insertError } = await supabase
        .from("dishes")
        .insert([insertData] as any)
        .select()
        .single();

      if (insertError) throw insertError;

      await fetchDishes();

      // Convert snake_case to camelCase for return
      const row = data as DishRow;
      return row
        ? {
            id: row.id,
            name: row.name,
            type: row.type as any,
            proteins: row.proteins || undefined,
            isSpicy: row.is_spicy,
            time: row.time as any,
            keyIngredients: row.key_ingredients,
            status: row.status as any,
            notes: row.notes || undefined,
            tags: row.tags || undefined,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
          }
        : null;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add dish");
      console.error("Error adding dish:", err);
      return null;
    }
  };

  const updateDish = async (id: string, dishData: Partial<DishFormData>): Promise<boolean> => {
    try {
      const updateData: DishUpdate = {};
      if (dishData.name !== undefined) updateData.name = dishData.name;
      if (dishData.type !== undefined) updateData.type = dishData.type;
      if (dishData.proteins !== undefined) updateData.proteins = dishData.proteins.length > 0 ? dishData.proteins : null;
      if (dishData.isSpicy !== undefined) updateData.is_spicy = dishData.isSpicy;
      if (dishData.time !== undefined) updateData.time = dishData.time;
      if (dishData.keyIngredients !== undefined) updateData.key_ingredients = dishData.keyIngredients;
      if (dishData.status !== undefined) updateData.status = dishData.status;
      if (dishData.notes !== undefined) updateData.notes = dishData.notes || null;
      if (dishData.tags !== undefined) updateData.tags = dishData.tags && dishData.tags.length > 0 ? dishData.tags : null;
      updateData.updated_at = new Date().toISOString();

      const { error: updateError } = await (supabase as any).from("dishes").update(updateData).eq("id", id);

      if (updateError) throw updateError;

      await fetchDishes();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update dish");
      console.error("Error updating dish:", err);
      return false;
    }
  };

  const deleteDish = async (id: string): Promise<boolean> => {
    try {
      const { error: deleteError } = await supabase.from("dishes").delete().eq("id", id);

      if (deleteError) throw deleteError;

      await fetchDishes();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete dish");
      console.error("Error deleting dish:", err);
      return false;
    }
  };

  useEffect(() => {
    fetchDishes();
  }, []);

  return {
    dishes,
    loading,
    error,
    addDish,
    updateDish,
    deleteDish,
    refetch: fetchDishes,
  };
}
