const SYSTEM_PROMPT = `You are LifePilot AI, a concise productivity coach inside a task app.
Keep answers short (under 180 words), friendly, and actionable. Use bullet points when listing steps.
If the user seems unmotivated, be encouraging. No markdown code blocks unless they ask for code.`;

function fallbackReply(message) {
  const m = message.toLowerCase();
  if (m.includes("lazy") || m.includes("tired") || m.includes("unmotivated")) {
    return `Totally normal to feel that way. Try this:\n\n• Do one tiny task (2 minutes) — momentum beats motivation.\n• Set a 10-minute timer and only work until it rings.\n• Stand up, stretch, then pick the easiest item on your list.\n\nYou've got this — small steps still count as progress.`;
  }
  if (m.includes("plan") && m.includes("day")) {
    return `Here's a simple day plan:\n\n• Brain-dump everything, then pick 3 priorities.\n• Block 25-minute focus sprints with 5-minute breaks.\n• Batch shallow tasks (email) after deep work.\n• End the day by writing tomorrow's first task.\n\nWant me to tailor this around your actual tasks?`;
  }
  if (m.includes("react") || m.includes("learn")) {
    return `Learning React — lean path:\n\n• Build a tiny counter app (state + events).\n• Add a list with keys and conditional render.\n• Fetch data with useEffect and handle loading/errors.\n• Introduce React Router for two pages.\n\nSpend 45 min/day coding, not only watching — you'll retain more.`;
  }
  return `Thanks for sharing. Here's a quick nudge:\n\n• Pick one outcome for the next hour.\n• Break it into 3 concrete steps.\n• Start with the smallest step right now.\n\nTell me what's on your plate and I can help you order it.`;
}

export async function getAiReply(userMessage) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key?.trim()) {
    return { reply: fallbackReply(userMessage), source: "local" };
  }

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://lifepilot.local",
        "X-Title": "LifePilot AI MVP",
      },
      body: JSON.stringify({
        model: "google/gemma-2-9b-it:free",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        max_tokens: 400,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn("OpenRouter error:", res.status, errText);
      return { reply: fallbackReply(userMessage), source: "local" };
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return { reply: fallbackReply(userMessage), source: "local" };
    }
    return { reply: text, source: "openrouter" };
  } catch (e) {
    console.warn("AI fetch failed:", e.message);
    return { reply: fallbackReply(userMessage), source: "local" };
  }
}
