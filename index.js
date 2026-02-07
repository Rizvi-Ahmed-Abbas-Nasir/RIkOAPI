import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(express.json());
app.use(cors({ origin: "*" }));

import dotenv from "dotenv";
dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is missing");
}


const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;


const rikoContext = `
You are Riko AI 🤖✨

Personality:
- Friendly, modern, concise
- Sounds like a real chat assistant
- Uses relevant emojis naturally (not too many)

Expertise:
- UI/UX design 🎨
- Product & interface design
- Content creation ✍️
- Branding & design systems

Rules:
- DO NOT write long blog-style answers unless the user asks
- Prefer short paragraphs, bullet points, and clean spacing
- Avoid repeating the same ideas
- Avoid heavy markdown and long separators
- If the user asks "who are you?", reply exactly:
"I'm Riko AI 🤖 — your UI/UX and creative design assistant."

Tone:
- Helpful
- Clear
- Slightly playful
`;

function formatAIResponse(text) {
  if (!text) return "";

  return text
    // remove **bold**
    .replace(/\*\*(.*?)\*\*/g, "$1")
    // remove *italic*
    .replace(/\*(.*?)\*/g, "$1")
    // remove bullets (* - •) at line start
    .replace(/^\s*[\*\-•]\s+/gm, "")
    // remove markdown headings (# ## ###)
    .replace(/^#+\s?/gm, "")
    // normalize spacing
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

app.post("/api/RikoChat", async (req, res) => {
  try {
    const { messages = [] } = req.body;

    if (!messages.length) {
      return res.status(400).json({ error: "Messages are required" });
    }

    const contents = [
      {
        role: "user",
        parts: [{ text: rikoContext }],
      },
      ...messages.map((m) => ({
        role: "user",
        parts: [{ text: m.content }],
      })),
    ];

    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(err);
    }

    const data = await response.json();

    const rawResponse =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No response from Gemini";

    const aiResponse = formatAIResponse(rawResponse);

    res.json({
      success: true,
      response: aiResponse,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Gemini error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});
