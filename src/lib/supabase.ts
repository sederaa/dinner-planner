import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";

const supabaseUrl = "https://dinldktgibeniytiidem.supabase.co";
const supabasePublishableKey = "sb_publishable_QPZMeH6NWLtAM1fPxN2hBA_l73QM7q0";

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey);
