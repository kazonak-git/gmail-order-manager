import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!;

// Client-side (browser) kliens
export const supabase = createClient(supabaseUrl, supabasePublishableKey);

// Server-side kliens (API route-okhoz)
export const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey);
