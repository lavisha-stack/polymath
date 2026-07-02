// api/prompt.js
// Generates a fresh prompt for a given domain using Gemini.
// Falls back to a small local seed list if the API call fails for any reason
// (no key set yet, network issue, over the free quota, etc).

const SEED_PROMPTS = {
  communication: [
    "Explain why the sky is blue, as if to a curious 8-year-old.",
    "Describe your favorite meal in enough detail someone could picture it.",
    "Make the case for your favorite season being the best one.",
    "Explain what a podcast is to someone who's never heard of the internet.",
    "Describe a place you'd love to visit and why.",
    "Explain how to tie a shoelace, without using your hands to demonstrate.",
    "Make an argument for reading fiction over nonfiction.",
    "Describe your morning routine like it's a story with a plot.",
  ],
  study: [
    "Pick any concept you studied this week and explain it with zero notes.",
    "Explain the last formula or rule you learned as if teaching a beginner.",
    "What's one thing you learned recently that you still find confusing? Try explaining it anyway.",
    "Summarize the last thing you read in exactly three sentences, from memory.",
    "Explain how two things you've studied recently might be connected.",
    "Teach a concept you know well to an imaginary student who keeps asking 'but why?'",
  ],
  writing: [
    "Write about a smell that takes you back to a specific memory.",
    "Describe a color without naming it.",
    "Write the opening line of a story that starts mid-argument.",
    "Write about something ordinary as if it were extraordinary.",
    "Describe your day so far, but only using questions.",
    "Write a short letter to yourself from five years in the future.",
    "Invent a small, strange rule for an imaginary world and explain it.",
    "Write about waiting for something, without saying what it is.",
  ],
};

const DOMAIN_INSTRUCTIONS = {
  communication:
    "Give ONE short, specific prompt/topic for a person to speak out loud about for 60 seconds. It should be concrete and easy to picture, not abstract. Return ONLY the prompt text, nothing else, no quotes, no numbering.",
  study:
    "Give ONE short prompt that asks the person to explain a concept they've recently studied, in their own words, with no notes. Keep it general since you don't know their exact subject. Return ONLY the prompt text, nothing else, no quotes, no numbering.",
  writing:
    "Give ONE short, evocative creative writing prompt suitable for a 5-minute timed micro-draft. Return ONLY the prompt text, nothing else, no quotes, no numbering.",
};

function pickSeed(domain) {
  const list = SEED_PROMPTS[domain];
  return list[Math.floor(Math.random() * list.length)];
}

export default async function handler(req, res) {
  const domain = (req.query.domain || (req.body && req.body.domain) || "").toString();

  if (!DOMAIN_INSTRUCTIONS[domain]) {
    res.status(400).json({ error: "Unknown domain. Use communication, study, or writing." });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    res.status(200).json({ prompt: pickSeed(domain), source: "seed" });
    return;
  }

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: DOMAIN_INSTRUCTIONS[domain] }] }],
        }),
      }
    );

    if (!response.ok) throw new Error("Gemini request failed: " + response.status);

    const data = await response.json();
    const text =
      data &&
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0] &&
      data.candidates[0].content.parts[0].text;

    if (!text || !text.trim()) throw new Error("Empty response from Gemini");

    res.status(200).json({ prompt: text.trim(), source: "gemini" });
  } catch (err) {
    res.status(200).json({ prompt: pickSeed(domain), source: "seed" });
  }
}
