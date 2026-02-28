export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      dishes: {
        Row: {
          id: string;
          name: string;
          type: string[];
          proteins: string[] | null;
          is_spicy: boolean;
          time: string;
          key_ingredients: string[];
          status: string;
          notes: string | null;
          tags: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          type: string[];
          proteins?: string[] | null;
          is_spicy?: boolean;
          time: string;
          key_ingredients: string[];
          status?: string;
          notes?: string | null;
          tags?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          type?: string[];
          proteins?: string[] | null;
          is_spicy?: boolean;
          time?: string;
          key_ingredients?: string[];
          status?: string;
          notes?: string | null;
          tags?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      meal_plans: {
        Row: {
          id: string;
          date: string;
          main_dish_id: string | null;
          main_dish_type: "dish" | "leftovers" | "eating_out" | null;
          side_dish_ids: string[] | null;
          dessert_dish_id: string | null;
          has_guests: boolean;
          person_a_office_next_day: boolean;
          person_b_office_next_day: boolean;
          locked: boolean;
          is_blocked: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          date: string;
          main_dish_id?: string | null;
          main_dish_type?: "dish" | "leftovers" | "eating_out" | null;
          side_dish_ids?: string[] | null;
          dessert_dish_id?: string | null;
          has_guests?: boolean;
          person_a_office_next_day?: boolean;
          person_b_office_next_day?: boolean;
          locked?: boolean;
          is_blocked?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          date?: string;
          main_dish_id?: string | null;
          main_dish_type?: "dish" | "leftovers" | "eating_out" | null;
          side_dish_ids?: string[] | null;
          dessert_dish_id?: string | null;
          has_guests?: boolean;
          person_a_office_next_day?: boolean;
          person_b_office_next_day?: boolean;
          locked?: boolean;
          is_blocked?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}
