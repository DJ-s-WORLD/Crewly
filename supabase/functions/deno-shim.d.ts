/**
 * Minimal globals for Supabase Edge (Deno). The main app uses Vite/Node types;
 * this file is only for tooling when editing functions under supabase/functions/.
 */
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};
