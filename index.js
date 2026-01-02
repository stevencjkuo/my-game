import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI, SchemaType } from "@google/genai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 允許你的前端網域 (包含 Localhost, GitHub Pages, Vercel)
app.use(cors({
  origin: [
    "http://127.0.0.1:5173", // Vite 預設
    "http://localhost:5173",
    "https://stevencjkuo.github.io",
    /\.vercel\.app$/ // 允許所有 Vercel 預覽網址
  ]
}));

app.use(express.json());

// 初始化 Gemini SDK
const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);

// --- 從原 geminiService 搬過來的設定 ---

const LEVEL_PROMPTS = {
  'Junior': 'Taiwan Junior High (1200-2000 vocab, CEFR A1-A2). Focus daily life.',
  'Senior': 'Taiwan Senior High (7000 vocab, GSAT level 3-6, CEFR B1-B2). Focus academic/abstract.',
  'TOEIC': 'Business English, workplace, travel, marketing for TOEIC exam.'
};

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

// --- API 路由設定 ---

// 1. 單個單字查詢
app.post("/api/fetch-word", async (req, res) => {
  try {
    const { term, difficulty, targetLang } = req.body;
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash", // 建議使用穩定版
      generationConfig: { responseMimeType: "application/json", responseSchema: WORD_SCHEMA }
    });

    const prompt = `Provide linguistic analysis for the English word "${term}". Level: ${LEVEL_PROMPTS[difficulty]}. Target language: ${targetLang.name}. Output JSON.`;
    const result = await model.generateContent(prompt);
    res.json(JSON.parse(result.response.text()));
  } catch (error) {
    console.error("Fetch Word Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 2. 批量生成單字
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

    const prompt = `Synthesize 10 useful English words for a learner. Level: ${LEVEL_PROMPTS[difficulty]}. Target language: ${targetLang.name}. Avoid: ${existingWords.join(', ')}.`;
    const result = await model.generateContent(prompt);
    res.json(JSON.parse(result.response.text()));
  } catch (error) {
    console.error("Batch Generate Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 3. TTS 語音合成
app.post("/api/generate-tts", async (req, res) => {
  try {
    const { text, langName } = req.body;
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // TTS 需確認模型支援度

    const result = await model.generateContent({
      contents: [{ parts: [{ text: `Read this ${langName} text clearly: ${text}` }] }],
      generationConfig: { responseModalities: ["AUDIO"] }
    });

    const audioData = result.response.candidates[0].content.parts.find(p => p.inlineData)?.inlineData.data;
    res.json({ audioData });
  } catch (error) {
    console.error("TTS Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => console.log(`🚀 Server ready at http://localhost:${PORT}`));
