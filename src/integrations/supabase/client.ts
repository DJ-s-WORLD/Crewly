import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

function stripQuotes(v: string | undefined): string {
  if (!v) return "";
  const t = v.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

const SUPABASE_URL = stripQuotes(import.meta.env.VITE_SUPABASE_URL as string | undefined);
const SUPABASE_PUBLISHABLE_KEY = stripQuotes(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined);

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    "[LifePilot] Missing Supabase environment variables.\n\n" +
      "Add to a file named `.env` in the project root (next to vite.config.ts), not inside src/:\n\n" +
      "  VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co\n" +
      "  VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_or_publishable_key\n\n" +
      "Names must start with VITE_ (not NEXT_PUBLIC_). Restart the dev server after saving."
  );
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
