/// <reference path="../deno-shim.d.ts" />
import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "@supabase/supabase-js/cors";

/**
 * LifePilot AI — Edge Function: Groq (fast) + Gemini (smart).
 *
 * Secrets (Supabase Dashboard → Edge Functions → ai-chat):
 * - GROQ_API_KEY — Groq OpenAI-compatible API
 * - GEMINI_API_KEY — Google AI Studio key (Generative Language API)
 *
 * Body: { message: string, model?: "groq" | "gemini", timezone?: string }
 * Success: { reply: string }
 *
 * Fallback: if user requests Groq (or default) and Groq fails, Gemini is tried once when GEMINI_API_KEY is set.
 * If user requests Gemini and it fails, returns a friendly error (no Groq fallback per product rules).
 *
 * Deploy: supabase functions deploy ai-chat --no-verify-jwt
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama3-8b-8192";
const GEMINI_MODEL = "gemini-2.0-flash";
const CHAT_MAX_TOKENS = 768;

/** Merge SDK CORS (apikey, x-client-info, …) with explicit allow-list for browser + Supabase client. */
const corsResponseHeaders: Record<string, string> = {
  ...corsHeaders,
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, content-type, apikey, x-client-info, x-supabase-authorization, prefer",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsResponseHeaders, "Content-Type": "application/json" },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function retryAfterMs(res: Response): number | null {
  const h = res.headers.get("retry-after");
  if (!h) return null;
  const sec = Number.parseInt(h.trim(), 10);
  if (!Number.isFinite(sec) || sec < 0) return null;
  return Math.min(sec * 1000, 10_000);
}

function stripAssistantFormatting(text: string): string {
  return text
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/##/g, "")
    .replace(/#/g, "")
    .replace(/__/g, "")
    .replace(/_/g, " ")
    .replace(/```/g, "");
}

function parseModel(raw: unknown): "groq" | "gemini" {
  if (raw === "gemini" || raw === "groq") return raw;
  return "groq";
}

function friendlyGeminiError(detail: string): string {
  return `We couldn’t complete that with Gemini right now. ${detail || "Please try again in a moment."}`;
}

function friendlyBackupFailed(): string {
  return "LifePilot AI couldn’t get a response from Groq, and the backup model wasn’t available. Check Edge Function secrets (GROQ_API_KEY, GEMINI_API_KEY) or try again shortly.";
}

/** Groq chat/completions → reply text or null on failure (caller may fall back). */
async function completeGroq(
  apiKey: string,
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
): Promise<{ reply: string } | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        max_tokens: CHAT_MAX_TOKENS,
        temperature: 0.75,
      }),
    });

    const raw = await response.text();

    if (response.ok) {
      try {
        const data = JSON.parse(raw) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const text =
          data.choices?.[0]?.message?.content?.trim() || "Sorry, I couldn't generate a response.";
        return { reply: stripAssistantFormatting(text) };
      } catch {
        console.error("Groq: invalid JSON", raw);
        return null;
      }
    }

    console.error("Groq error:", response.status, raw);

    if (response.status === 429 && attempt < 2) {
      const fromHeader = retryAfterMs(response);
      await sleep(fromHeader ?? Math.min(700 * 2 ** attempt, 5000));
      continue;
    }

    return null;
  }
  return null;
}

/** Gemini generateContent → reply or error message for HTTP response body. */
async function completeGemini(
  apiKey: string,
  systemPrompt: string,
  userMessage: string
): Promise<{ reply: string } | { error: string }> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent` +
    `?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      generationConfig: {
        maxOutputTokens: CHAT_MAX_TOKENS,
        temperature: 0.75,
      },
    }),
  });

  const raw = await response.text();

  try {
    const data = JSON.parse(raw) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      error?: { message?: string; status?: string };
    };

    if (!response.ok) {
      const msg = data.error?.message || raw.slice(0, 200) || "Request failed";
      return { error: friendlyGeminiError(msg) };
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) {
      return { error: friendlyGeminiError("The model returned no text (possible safety filter).") };
    }
    return { reply: stripAssistantFormatting(text) };
  } catch {
    console.error("Gemini parse error:", raw);
    return { error: friendlyGeminiError("Invalid response from AI provider.") };
  }
}

function buildSystemPrompt(dateInfo: string): string {
  return `You are LifePilot AI — the user's elite performance coach, life strategist, and close friend who genuinely cares about their success.

CURRENT DATE AND TIME: ${dateInfo}
When the user asks about today's date or current day, use this exact info. Never guess dates.

YOUR IDENTITY:
- Your name is LifePilot AI
- Warm, sharp, high energy — push them to win

RESPONSE STYLE (CRITICAL):
- NEVER use markdown: no **, ##, *, _, code fences
- Plain text only, short lines, generous line breaks
- Use simple dashes (-) for lists
- 1-3 emojis per reply max

CONTENT:
- Actionable, specific, never generic fluff
- At least one surprising tip or hack when it fits
- If they feel lazy, fire them up with real tactics
- End with a clear next action they can do now`;
}

function buildDateInfo(now: Date, timezone?: string): string {
  try {
    if (timezone) {
      const localDate = now.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: timezone,
      });
      const localTime = now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: timezone,
      });
      return `${localDate}, ${localTime} (${timezone})`;
    }
  } catch {
    /* fall through */
  }
  return now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsResponseHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return json({ error: "Unauthorized" }, 401);
  }

  let message: string;
  let timezone: string | undefined;
  let modelChoice: "groq" | "gemini";
  try {
    const body = (await req.json()) as {
      message?: unknown;
      timezone?: unknown;
      model?: unknown;
    };
    message = typeof body.message === "string" ? body.message : "";
    timezone = typeof body.timezone === "string" ? body.timezone : undefined;
    modelChoice = parseModel(body.model);
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!message.trim()) {
    return json({ error: "Message is required" }, 400);
  }

  const groqKey = Deno.env.get("GROQ_API_KEY")?.trim();
  const geminiKey = Deno.env.get("GEMINI_API_KEY")?.trim();

  if (!groqKey && !geminiKey) {
    return json(
      {
        error:
          "AI is not configured. Add GROQ_API_KEY and/or GEMINI_API_KEY to Edge Function secrets.",
      },
      503
    );
  }

  const systemPrompt = buildSystemPrompt(buildDateInfo(new Date(), timezone));
  const openAiMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    { role: "user", content: message.trim() },
  ];

  try {
    if (modelChoice === "gemini") {
      if (!geminiKey) {
        return json(
          {
            error:
              "Gemini is not configured (missing GEMINI_API_KEY). Switch to Groq or add the secret.",
          },
          503
        );
      }
      const gem = await completeGemini(geminiKey, systemPrompt, message.trim());
      if ("reply" in gem) {
        return json({ reply: gem.reply });
      }
      return json({ error: gem.error }, 200);
    }

    // Default / Groq path
    if (groqKey) {
      const groq = await completeGroq(groqKey, openAiMessages);
      if (groq) {
        return json({ reply: groq.reply });
      }
    }

    // Groq failed or no Groq key — fall back to Gemini once
    if (geminiKey) {
      const gem = await completeGemini(geminiKey, systemPrompt, message.trim());
      if ("reply" in gem) {
        return json({ reply: gem.reply });
      }
      return json({ error: gem.error }, 200);
    }

    return json({ error: friendlyBackupFailed() }, 200);
  } catch (e) {
    console.error("ai-chat:", e);
    return json(
      {
        error: "Something went wrong on our side. Please try again.",
      },
      200
    );
  }
});
