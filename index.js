import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 設定 CORS 白名單
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

// 初始化 Gemini SDK
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 延遲工具函式
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 核心重試邏輯：處理 429 頻率限制錯誤
 */
async function generateContentWithRetry(model, prompt, maxRetries = 3) {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      const result = await model.generateContent(prompt);
      return result;
    } catch (error) {
      // 檢查是否為 429 錯誤
      if (error.status === 429 || (error.message && error.message.includes("429"))) {
        retries++;
        // 指數退避：分別等待約 4s, 8s, 16s
        const waitTime = Math.pow(2, retries + 1) * 1000 + Math.random() * 1000;
        console.warn(`[Quota] 觸發頻率限制，嘗試第 ${retries} 次重試，等待 ${Math.round(waitTime/1000)} 秒...`);
        await delay(waitTime);
      } else {
        throw error; // 其他錯誤直接拋出
      }
    }
  }
  throw new Error("超過最大重試次數，請稍後再試或檢查 API 額度。");
}

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
      model: "models/gemini-2.0-flash",
      generationConfig: { responseMimeType: "application/json", responseSchema: WORD_SCHEMA }
    });

    const prompt = `Provide linguistic analysis for the English word "${term}". Level: ${difficulty}. Target language: ${targetLang.name}.`;
    
    // 使用重試機制呼叫
    const result = await generateContentWithRetry(model, prompt);
    res.json(JSON.parse(result.response.text()));
  } catch (error) {
    console.error("Fetch Word Error:", error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

// 路由 2: 批量生成單字
app.post("/api/generate-batch", async (req, res) => {
  try {
    const { difficulty, targetLang, existingWords } = req.body;
    const model = genAI.getGenerativeModel({ 
      model: "models/gemini-2.0-flash",
      generationConfig: { 
        responseMimeType: "application/json", 
        responseSchema: { type: "array", items: WORD_SCHEMA } 
      }
    });

    const prompt = `Synthesize 10 useful English words for a learner. Level: ${difficulty}. Target language: ${targetLang.name}. Avoid these words: ${existingWords?.join(', ') || 'none'}.`;
    
    // 使用重試機制呼叫
    const result = await generateContentWithRetry(model, prompt);
    res.json(JSON.parse(result.response.text()));
  } catch (error) {
    console.error("Batch Generate Error:", error);
    res.status(error.status || 500).json({ error: error.message });
  }
}); 

app.listen(PORT, () => console.log(`🚀 Render Server running on port ${PORT}`));
