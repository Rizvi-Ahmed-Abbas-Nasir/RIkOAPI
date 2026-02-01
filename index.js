import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(express.json());
app.use(cors({ origin: "*" }));


const GEMINI_API_KEY =  "AIzaSyCs7m1mpQfb4-Go-PckeiQRR5hiEMfHAE0";
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

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

app.post("/api/RikoChat", async (req, res) => {
  try {
    const { messages = [] } = req.body;

    if (!messages.length) {
      return res.status(400).json({ error: "Messages are required" });
    }

    // Gemini format
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

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=AIzaSyCtA5cYEtgntvDlpyAlOvmTtc2ct4mcH08`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(err);
    }

    const data = await response.json();

    const aiResponse =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No response from Gemini";

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

// Health check
app.get("/health", (_, res) => {
  res.json({ status: "ok", service: "Riko Gemini API" });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Riko Gemini backend running on port ${PORT}`);
});
