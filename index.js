import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 設定 CORS 白名單，允許 Vercel 與在地端測試
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

app.get("/", (req, res) => {
  res.send("Render Gemini Relay is running");
});

// 初始化 Gemini SDK (金鑰從環境變數讀取)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 修正後的 WORD_SCHEMA 定義
const WORD_SCHEMA = {
  type: "object",
  properties: {
    term: { type: "string" },
    definition: { type: "string" },
    translations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          pos: { type: "string" },
          explanation: { type: "string" }
        },
        required: ["text", "pos"]
      }
    },
    examples: {
      type: "array",
      items: {
        type: "object",
        properties: {
          en: { type: "string" },
          zh: { type: "string" }
        },
        required: ["en", "zh"]
      }
    },
    synonyms: { type: "array", items: { type: "string" } },
    antonyms: { type: "array", items: { type: "string" } }
  },
  required: ["term", "definition", "translations", "examples"]
};

// 路由 1: 單個單字查詢
app.post("/api/fetch-word", async (req, res) => {
  try {
    const { term, difficulty, targetLang } = req.body;
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json", responseSchema: WORD_SCHEMA }
    },{ apiVersion: "v1" });

    const prompt = `Provide linguistic analysis for the English word "${term}". Level: ${difficulty}. Target language: ${targetLang.name}.`;
    const result = await model.generateContent(prompt);
    res.json(JSON.parse(result.response.text()));
  } catch (error) {
    console.error("Fetch Word Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 路由 2: 批量生成單字
app.post("/api/generate-batch", async (req, res) => {
  try {
    const { difficulty, targetLang, existingWords } = req.body;
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { 
        responseMimeType: "application/json", 
        responseSchema: { type: "array", items: WORD_SCHEMA } 

      }
    },{apiVersion: "v1" });

    const prompt = `Synthesize 10 useful English words for a learner. Level: ${difficulty}. Target language: ${targetLang.name}. Avoid these words: ${existingWords?.join(', ') || 'none'}.`;
    const result = await model.generateContent(prompt);
    res.json(JSON.parse(result.response.text()));
  } catch (error) {
    console.error("Batch Generate Error:", error);
    res.status(500).json({ error: error.message });
  }
}); 

app.listen(PORT, () => console.log(`🚀 Render Server running on port ${PORT}`));

