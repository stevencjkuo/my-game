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
Provide a structured
