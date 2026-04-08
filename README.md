# LifePilot AI

Mobile-first productivity app: **Supabase** (Postgres + Auth + Edge Functions) for the live product, plus an **optional** Express + MongoDB API under `server/` if you want the older REST stack.

## Folder layout

| Path | Purpose |
|------|---------|
| `src/` | React + TypeScript app (Vite). Pages, hooks, Supabase client, UI. |
| `supabase/` | Migrations and Edge Function `ai-chat` (Groq + Gemini via Edge Secrets). |
| `server/` | Optional Node API (JWT, Mongoose). Not required for the Supabase UI. |

## Quick start (Supabase — main app)

### 0. Two different “backends” (important)

| What you start | Database it uses | Creates Supabase tables? |
|----------------|------------------|---------------------------|
| `npm run dev` (Vite) | None (browser talks to Supabase over HTTPS) | **No** |
| `npm run dev:api` (`server/`) | **MongoDB** (Mongoose) | **No** — Mongo is separate from Supabase |
| **Supabase Postgres** | Cloud Postgres | Tables appear only after **SQL migrations** or **`npm run db:sync`** |

Starting a Node server does **not** provision Supabase. Supabase tables are created in **PostgreSQL** via SQL (dashboard, CLI, or `db:sync` below).

### 1. Install

```bash
npm install
```

### 2. Environment variables

Create a `.env` file in the **project root** (next to `package.json`):

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_ANON_KEY
```

You can copy the same values from the Supabase dashboard: **Project Settings → API** (Project URL and `anon` `public` key).

> Your local `env.txt` is a handy reference; prefer renaming/copying into `.env` so Vite loads it. **Do not commit real keys** to git.

### 3. Database (Supabase Postgres)

Tables are created by migrations in `supabase/migrations/` (or the bootstrap script):

- `profiles` — name, streak, `last_active_date`, avatar, mood, theme (`bg_color`), etc.
- `tasks` — per-user tasks.
- `chat_messages` — AI chat history.

**Option A — Automatic sync from your machine (recommended for “make tables exist”)**

1. In Supabase: **Project Settings → Database** → copy the **Connection string** as **URI** (direct Postgres, port **5432**). Put your database password in the URL.
2. Add to root `.env`:

   ```env
   DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres
   ```

3. Run:

   ```bash
   npm run db:sync
   ```

   This executes `supabase/bootstrap_missing_tables.sql` against your project.

4. Optional: start Vite and try syncing first only when `DATABASE_URL` is set (warns and continues if missing):

   ```bash
   npm run dev:all
   ```

**Option B — Supabase CLI**

- **Hosted project:** `supabase link` then `supabase db push` (applies `supabase/migrations/`).
- **Local Supabase:** `supabase start` then `supabase db reset`.

**Option C — SQL Editor (no `DATABASE_URL`)**

Paste and run `supabase/bootstrap_missing_tables.sql` in **SQL Editor** (see PGRST205 section below).

**Error `PGRST205` — “Could not find the table `public.tasks`”**

That means your **hosted** Supabase project does not have the LifePilot tables yet (migrations were never applied to *this* project, or `.env` points at a different project than the one you migrated).

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **SQL Editor**.
2. Open the file **`supabase/bootstrap_missing_tables.sql`** in this repo, copy its full contents, paste into the editor, and click **Run**.
3. It creates `profiles`, `tasks`, `chat_messages`, **social tables** (`follows`, `activities`, `conversations`, `conversation_participants`, `social_messages`, `app_notifications`), the `get_or_create_direct_conversation` RPC, related triggers, RLS, `tasks.completed_at`, the `avatars` bucket policies, and the signup trigger. It is safe to run more than once.
4. Hard-refresh the app (or wait a few seconds) so PostgREST picks up the new tables (the script ends with `NOTIFY pgrst, 'reload schema'` to refresh the API schema cache).

**Error `PGRST205` for `public.follows`, `public.activities`, or `public.app_notifications`** — same fix: run the full **`supabase/bootstrap_missing_tables.sql`** again (or apply `supabase/migrations/20260406120000_social_community.sql`), then refresh the app.

Confirm **Project Settings → API → Project URL** matches `VITE_SUPABASE_URL` in your root `.env`.

### 4. AI chat Edge Function

The app calls `supabase.functions.invoke("ai-chat", …)`.

**Deploy & secrets**

**If you see `Access token not provided`** — the Supabase CLI is not logged in. This is not a bug in the repo; you must authenticate once:

1. **Login (interactive, recommended)**  
   ```bash
   npx supabase login
   ```  
   Complete the browser flow or paste a **personal access token** when prompted.

2. **Or set a token (CI / non-interactive)**  
   Create a token: [Supabase Dashboard → Account → Access Tokens](https://supabase.com/dashboard/account/tokens). Then in **PowerShell** (current session):

   ```powershell
   $env:SUPABASE_ACCESS_TOKEN = "YOUR_ACCESS_TOKEN_HERE"
   ```

   Or in **Command Prompt**: `set SUPABASE_ACCESS_TOKEN=your_token_here`

3. **Link this folder to your project** (once per machine / clone):

   ```bash
   npx supabase link --project-ref ckepekynnvhdgwcrfzje
   ```

   Use your real **project ref** from the dashboard URL if it differs from `supabase/config.toml`.

4. **Deploy the function (important: disable gateway JWT for this function)**

   The hosted API **validates JWT before your code runs**. The browser’s **OPTIONS** preflight does not satisfy that check, so you get a misleading **CORS** error unless JWT verification is off **at the gateway**. Your function still requires a valid `Authorization` bearer token and calls `auth.getUser()`.

   ```bash
   npx supabase functions deploy ai-chat --no-verify-jwt
   ```

   If you skip `link`, pass your project ref:

   ```bash
   npx supabase functions deploy ai-chat --no-verify-jwt --project-ref ckepekynnvhdgwcrfzje
   ```

   Or use the npm script: `npm run deploy:ai-chat`

- **Secrets** (Dashboard → Edge Functions → `ai-chat` → Secrets, or CLI). Set **at least one** of:
  - **`GROQ_API_KEY`** — [Groq Cloud Console](https://console.groq.com). Chat model: **`llama3-8b-8192`** (fast).
  - **`GEMINI_API_KEY`** — [Google AI Studio](https://aistudio.google.com/apikey). Model: **`gemini-2.0-flash`** (smart).

**Behavior**

- The app sends `{ message, model: "groq" | "gemini", timezone? }`. Success: **`{ reply: string }`**. Recoverable failures return **`{ error: string }`** with HTTP 200 so the client can show a toast without a low-level invoke error.
- **Groq → Gemini:** if the user picks **Groq** (default) and Groq fails, the function automatically tries **Gemini** when `GEMINI_API_KEY` is set.
- **Gemini only:** if the user picks **Gemini** and it fails, the function returns a **friendly error** (no Groq fallback).

**React app** — example body:

```ts
const { data, error } = await supabase.functions.invoke("ai-chat", {
  body: {
    message: input,
    model: "groq", // or "gemini"
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  },
});
if (data?.reply) {
  /* success */
}
if (data && "error" in data && !("reply" in data)) {
  /* show data.error */
}
```

**CORS / “preflight does not have HTTP ok status” / `net::ERR_FAILED`**

What is happening:

1. The browser sends **OPTIONS** (preflight) to `…/functions/v1/ai-chat`.
2. If **Verify JWT** is still **on** at the Supabase **gateway**, that request can return **401/403** before your Edge Function runs — so your CORS headers never apply.
3. Chrome then reports a **CORS** error (“does not have HTTP ok status”) even though the real issue is **gateway JWT + OPTIONS**.

**Fix (required for browser `functions.invoke`):**

1. Deploy with **`--no-verify-jwt`** (see step 4 above), **or**
2. **Dashboard:** open your project → **Edge Functions** → **`ai-chat`** → turn **off** JWT verification / “Verify JWT” for this function (wording varies by dashboard version), **or**
3. Keep **`[functions.ai-chat] verify_jwt = false`** in `supabase/config.toml` **and** redeploy; if CORS persists, use **`--no-verify-jwt`** once so the hosted setting is definitely updated.

Then hard-refresh the app and try again. Ensure you are **signed in** so the real **POST** includes `Authorization: Bearer <user_jwt>`.

**Checklist:** `GROQ_API_KEY` and/or `GEMINI_API_KEY` · function redeployed · root `.env` has `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` · user signed in on the AI chat page.

### 5. Storage (avatars)

Migration creates the `avatars` bucket and RLS policies. No extra step if migrations applied.

### 6. Run the web app

```bash
npm run dev
```

Default URL: `http://localhost:8080` (see `vite.config.ts`).

**Vite `EPERM` / `rmdir` on `node_modules/.vite`** (common if the repo is under **OneDrive**): sync locks that folder. This project sets `cacheDir` to `%USERPROFILE%\.cache\lifepilot-vite` so the dev server avoids OneDrive. If you still see errors, close other terminals using the app, stop OneDrive “Files On-Demand” for this folder, or delete `node_modules/.vite` after quitting all dev servers.

---

## Optional: MongoDB + Express API (`server/`)

Used only if you want the separate REST API (JWT, `/api/tasks`, etc.). The **Supabase + Vite frontend does not use this** by default.

1. Install: `cd server && npm install`
2. Copy `server/.env.example` → `server/.env` and set `MONGODB_URI`, `JWT_SECRET`.
3. Start MongoDB locally or use Atlas.
4. Run: `npm run dev:api` from the repo root, or `npm run dev` inside `server/`.

If MongoDB is down, the API process will exit; the Vite app can still run on Supabase alone.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server (main UI) |
| `npm run dev:all` | If `DATABASE_URL` is set, syncs Postgres schema then starts Vite; otherwise warns and starts Vite |
| `npm run db:sync` | Applies `supabase/bootstrap_missing_tables.sql` via `DATABASE_URL` |
| `npm run build` | Production build → `dist/` |
| `npm run dev:api` | Optional Express + **MongoDB** API (does not touch Supabase) |

---

## Security note

Rotate any keys that were pasted into chat or committed by mistake; use `.env` locally and your host’s secret store in production.
