// api/feedback.js
// Sends the user's response text to Gemini and returns short, specific feedback.
// No seed fallback here on purpose — feedback genuinely needs the model,
// so on failure we return a clear, honest message instead of a fake one.

const DOMAIN_CONTEXT = {
  communication:
    "The user spoke out loud on a topic for about 60 seconds and typed up roughly what they said. Give brief, specific, encouraging feedback on clarity and structure — 3-4 sentences max. Point out one concrete strength and one concrete thing to try next time.",
  study:
    "The user tried to explain a concept from memory, with no notes, as a study/retrieval exercise. Give brief feedback on where their explanation was clear versus where it seemed shaky or vague — 3-4 sentences max. Be specific, not generic.",
  writing:
    "The user wrote a short timed creative micro-draft. Give brief, encouraging feedback on voice and imagery — 3-4 sentences max. Point out one specific line or choice that worked, and one gentle suggestion.",
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST." });
    return;
  }

  const { domain, text } = req.body || {};

  if (!DOMAIN_CONTEXT[domain] || !text || !text.trim()) {
    res.status(400).json({ error: "Missing domain or text." });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(200).json({
      feedback:
        "No API key configured yet — feedback isn't available until GEMINI_API_KEY is set in Vercel's environment variables.",
    });
    return;
  }

  try {
    const prompt =
      DOMAIN_CONTEXT[domain] + '\n\nHere is what the user wrote:\n"' + text.trim() + '"';

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!response.ok) throw new Error("Gemini request failed: " + response.status);

    const data = await response.json();
    const feedbackText =
      data &&
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0] &&
      data.candidates[0].content.parts[0].text;

    if (!feedbackText || !feedbackText.trim()) throw new Error("Empty response from Gemini");

    res.status(200).json({ feedback: feedbackText.trim() });
  } catch (err) {
    res.status(200).json({
      feedback:
        "Couldn't get feedback right now — the API may be busy or over its free quota for the moment. Try again shortly.",
    });
  }
}
