import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import OpenAI from "openai";

const app = express();

// Configure CORS properly
app.use(cors({
  origin: "*", // Or specify your frontend URL: "https://riko-lake.vercel.app"
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

// Handle preflight requests explicitly
app.options("*", cors());

app.use(express.json());

import dotenv from "dotenv";


dotenv.config();
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is missing");
}


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

  // Step 1: Clean markdown
  let cleaned = text
    .replace(/\*\*(.*?)\*\*/g, "$1")   // bold
    .replace(/\*(.*?)\*/g, "$1")       // italic
    .replace(/^#+\s?/gm, "")           // headings
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Step 2: Convert bullet lists to numbered lists
  const lines = cleaned.split("\n");
  let counter = 1;
  let inList = false;

  const formattedLines = lines.map((line) => {
    if (/^\s*[\*\-•]\s+/.test(line)) {
      if (!inList) {
        counter = 1;
        inList = true;
      }
      return `${counter++}. ${line.replace(/^\s*[\*\-•]\s+/, "")}`;
    } else {
      inList = false;
      return line;
    }
  });

  return formattedLines.join("\n").trim();
}


app.post("/api/RikoChat", async (req, res) => {
  try {
    const { messages = [] } = req.body;

    if (!messages.length) {
      return res.status(400).json({ error: "Messages are required" });
    }

    // Convert chat history → single input text
    const conversation = messages
      .map(m => `${m.role || "user"}: ${m.content}`)
      .join("\n");

    const response = await client.responses.create({
      model: "gpt-5-mini",   // ✅ your purchased model
      input: `${rikoContext}\n\n${conversation}`,
    });

    const rawResponse =
      response.output_text || "No response from GPT";

    const aiResponse = formatAIResponse(rawResponse);

    res.json({
      success: true,
      response: aiResponse,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error("❌ GPT error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});


// Add a test endpoint to verify the API is working
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "OK", 
    service: "Riko Chat API",
    timestamp: new Date().toISOString() 
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Health check: http://localhost:${PORT}/api/health`);
});