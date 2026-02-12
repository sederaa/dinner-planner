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
    };
  };
}
