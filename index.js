import express from "express";
import cors from "cors";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

app.options("*", cors());

// Increase payload limit to 20MB to handle base64 file uploads
app.use(express.json({ limit: "20mb" }));

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is missing");
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
- Analyzing images, screenshots, and documents for social media insights

Rules:
- DO NOT write long blog-style answers unless the user asks
- Prefer short paragraphs, bullet points, and clean spacing
- Avoid repeating the same ideas
- Avoid heavy markdown and long separators
- When the user shares an image, analyze it and give relevant social media / content advice
- When the user shares a document, extract key info and give relevant suggestions
- If the user asks "who are you?", reply exactly:
"I'm Riko AI 🤖 — your UI/UX and creative design assistant."

Tone:
- Helpful
- Clear
- Slightly playful
`;

function formatAIResponse(text) {
  if (!text) return "";

  let cleaned = text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/^#+\s?/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

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

/**
 * Convert a chat message (which may include attachments) into
 * the OpenAI `messages` array format supporting vision + text.
 */
function buildOpenAIMessages(messages) {
  const systemMessage = {
    role: "system",
    content: rikoContext,
  };

  const converted = messages.map((msg) => {
    const { role, content, attachments } = msg;

    // If no attachments, simple text message
    if (!attachments || attachments.length === 0) {
      return { role, content };
    }

    // Build multipart content array for messages with attachments
    const contentParts = [];

    // Add text part first (if any)
    if (content) {
      contentParts.push({ type: "text", text: content });
    }

    for (const att of attachments) {
      if (att.type === "image") {
        // Image attachment — use vision input
        contentParts.push({
          type: "image_url",
          image_url: {
            url: `data:${att.mimeType};base64,${att.base64}`,
            detail: "auto",
          },
        });
      } else if (att.type === "document") {
        // Document (PDF, TXT, DOCX) — extract as text context
        // For PDFs and DOCX, OpenAI doesn't read binary natively via chat completions,
        // so we send a note to the model and include the base64 for PDFs (gpt-4o supports PDF via file input)
        // For simplicity and broad model support, we embed the content description in text
        if (att.mimeType === "application/pdf") {
          // GPT-4o supports PDF via content type "file"
          contentParts.push({
            type: "text",
            text: `[User attached a PDF document named "${att.name}". Treat its content as context and provide relevant social media / content advice based on it.]`,
          });
          // Optionally, you can also try the file content block if your model supports it:
          // contentParts.push({ type: "file", file: { filename: att.name, file_data: `data:application/pdf;base64,${att.base64}` } });
        } else if (att.mimeType === "text/plain") {
          // For plain text, decode base64 and include directly
          try {
            const decoded = Buffer.from(att.base64, "base64").toString("utf-8");
            const trimmed = decoded.slice(0, 8000); // Limit to avoid token overflow
            contentParts.push({
              type: "text",
              text: `[User attached a text file named "${att.name}". Here is its content:\n\n${trimmed}]`,
            });
          } catch {
            contentParts.push({
              type: "text",
              text: `[User attached a text file named "${att.name}" but it could not be read.]`,
            });
          }
        } else {
          // DOCX or other binary docs — describe it
          contentParts.push({
            type: "text",
            text: `[User attached a document named "${att.name}" (${att.mimeType}). Acknowledge this and let them know you can best work with plain text, PDF, or image files for analysis.]`,
          });
        }
      }
    }

    // Fallback: if no text was added and only attachments exist, ensure we have text
    if (!content && contentParts.every((p) => p.type !== "text" || p.text === "")) {
      contentParts.unshift({ type: "text", text: "Please analyze this." });
    }

    return { role, content: contentParts };
  });

  return [systemMessage, ...converted];
}

app.post("/api/RikoChat", async (req, res) => {
  try {
    const { messages = [] } = req.body;

    if (!messages.length) {
      return res.status(400).json({ error: "Messages are required" });
    }

    const hasAttachments = messages.some(
      (m) => m.attachments && m.attachments.length > 0
    );

    let rawResponse;

    if (hasAttachments) {
      // Use chat completions API (supports vision + file content)
      const openAIMessages = buildOpenAIMessages(messages);

      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini", // Vision-capable model
        messages: openAIMessages,
        max_tokens: 1024,
      });

      rawResponse = completion.choices?.[0]?.message?.content || "No response from Riko AI";
    } else {
      // Use responses API for text-only (your existing setup)
      const conversation = messages
        .map((m) => `${m.role || "user"}: ${m.content}`)
        .join("\n");

      const response = await client.responses.create({
        model: "gpt-4o-mini",
        input: `${rikoContext}\n\n${conversation}`,
      });

      rawResponse = response.output_text || "No response from GPT";
    }

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

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    service: "Riko Chat API",
    timestamp: new Date().toISOString(),
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Health check: http://localhost:${PORT}/api/health`);
});