import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI, SchemaType } from "@google/genai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

/* -------------------- Middleware -------------------- */

app.use(cors({
  origin: [
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "https://eng-vantage.vercel.app",
    /\.vercel\.app$/
  ],
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json());

/* -------------------- Gemini Init -------------------- */

if (!process.env.GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY not set");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/* -------------------- Schema -------------------- */

const WORD_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    term: { type: SchemaType.STRING },
    definition: { type: SchemaType.STRING },
    translations: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          text: { type: SchemaType.STRING },
          pos: { type: SchemaType.STRING },
          explanation: { type: SchemaType.STRING }
        },
        required: ["text", "pos", "explanation"]
      }
    },
    examples: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          en: { type: SchemaType.STRING },
          zh: { type: SchemaType.STRING }
        },
        required: ["en", "zh"]
      }
    },
    synonyms: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING }
    },
    antonyms: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING }
    }
  },
  required: ["term", "definition", "translations", "examples"]
};

/* -------------------- Routes -------------------- */

/**
 * 單字查詢
 */
app.post("/api/fetch-word", async (req, res) => {
  try {
    const { term, difficulty, targetLang } = req.body;

    const prompt = `
Provide a structured linguistic analysis for the English word "${term}".
Difficulty: ${difficulty}
Target language: ${targetLang?.name || "Chinese (Traditional)"}
Return JSON only.
`;

    const result = await genAI.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [
        { role: "user", parts: [{ text: prompt }] }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: WORD_SCHEMA
      }
    });

    res.json(JSON.parse(result.text));
  } catch (err) {
    console.error("Fetch Word Error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 批量生成單字
 */
app.post("/api/generate-batch", async (req, res) => {
  try {
    const { difficulty, targetLang, existingWords = [] } = req.body;

    const prompt = `
Generate 10 useful English vocabulary words.
Difficulty: ${difficulty}
Target language: ${targetLang?.name || "Chinese (Traditional)"}
Avoid these words: ${existingWords.join(", ")}
Return JSON array only.
`;

    const result = await genAI.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [
        { role: "user", parts: [{ text: prompt }] }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.ARRAY,
          items: WORD_SCHEMA
        }
      }
    });

    res.json(JSON.parse(result.text));
  } catch (err) {
    console.error("Batch Generate Error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* -------------------- Health Check -------------------- */

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "gemini-relay" });
});

/* -------------------- Start Server -------------------- */

app.listen(PORT, () => {
  console.log(`🚀 Render Server running on port ${PORT}`);
});
