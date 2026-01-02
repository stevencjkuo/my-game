import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI, SchemaType } from "@google/genai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 允許你的前端來源
app.use(cors({
  origin: ["http://127.0.0.1:5173", "http://localhost:5173", "https://stevencjkuo.github.io", /\.vercel\.app$/]
}));
app.use(express.json());

// 初始化 Gemini
const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);

// 定義 Schema (原本在前端 geminiService 裡的那些)
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
        }
      }
    },
    examples: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          en: { type: SchemaType.STRING },
          zh: { type: SchemaType.STRING }
        }
      }
    },
    synonyms: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    antonyms: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
  },
  required: ["term", "definition", "translations", "examples"]
};

// 路由 1: 單個單字查詢 (對應前端 fetchWordDetails)
app.post("/api/fetch-word", async (req, res) => {
  try {
    const { term, difficulty, targetLang } = req.body;
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json", responseSchema: WORD_SCHEMA }
    });

    const prompt = `Provide linguistic analysis for the English word "${term}". Level: ${difficulty}. Target language: ${targetLang.name}.`;
    const result = await model.generateContent(prompt);
    res.json(JSON.parse(result.response.text()));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 路由 2: 批量生成單字 (對應前端 generateBatchWords)
app.post("/api/generate-batch", async (req, res) => {
  try {
    const { difficulty, targetLang, existingWords } = req.body;
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { 
        responseMimeType: "application/json", 
        responseSchema: { type: SchemaType.ARRAY, items: WORD_SCHEMA } 
      }
    });

    const prompt = `Synthesize 10 useful English words for a learner. Level: ${difficulty}. Target language: ${targetLang.name}. Avoid: ${existingWords.join(', ')}.`;
    const result = await model.generateContent(prompt);
    res.json(JSON.parse(result.response.text()));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => console.log(`🚀 Render Server running on port ${PORT}`));
