import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000; // Render 優先使用 10000

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

// 全域請求時間追蹤，用於防止併發請求過快
let lastRequestTime = Date.now();

// 延遲工具函式
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * 優化後的重試與流量控制邏輯
 */
async function generateContentWithRetry(model, prompt, maxRetries = 3) {
  let retries = 0;
  
  while (retries <= maxRetries) {
    try {
      // 1. 強制冷卻機制：確保兩次請求之間至少間隔 4 秒
      const now = Date.now();
      const minInterval = 4000; 
      const timeSinceLast = now - lastRequestTime;
      if (timeSinceLast < minInterval) {
        await delay(minInterval - timeSinceLast);
      }

      const result = await model.generateContent(prompt);
      
      // 成功後更新最後請求時間
      lastRequestTime = Date.now();
      return result;

    } catch (error) {
      const isRateLimit = error.status === 429 || (error.message && error.message.includes("429"));
      
      if (isRateLimit && retries < maxRetries) {
        retries++;
        // 指數級等待：12s, 24s, 48s (稍微縮短以防 Render 超時)
        const waitTime = Math.pow(2, retries) * 6000 + (Math.random() * 2000);
        
        console.warn(`[Quota] 偵測到限制，重試 ${retries}/${maxRetries}，等待 ${Math.round(waitTime/1000)} 秒...`);
        await delay(waitTime);
      } else {
        // 非 429 錯誤或已達重試上限則拋出
        throw error;
      }
    }
  }
  throw new Error("API 請求次數過多。如果您使用的是免費版，請稍後再試或減少批次數量。");
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
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }, 
      { apiVersion: "v1beta" }
    );

    const prompt = `Provide linguistic analysis for the English word "${term}". Level: ${difficulty}. Target language: ${targetLang.name}.`;
    
    // 修正：將 generationConfig 直接傳入 generateContent
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { 
        responseMimeType: "application/json", 
        responseSchema: WORD_SCHEMA 
      }
    });
    res.json(JSON.parse(result.response.text()));
  } catch (error) {
    console.error("Fetch Word Error:", error.message);
    res.status(error.status || 500).json({ error: error.message });
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
    });

    // 建議將 10 改為 8，降低單次生成的 Token 數與處理時間
    const prompt = `Synthesize 2 useful English words for a learner. Level: ${difficulty}. Target language: ${targetLang.name}. Avoid: ${existingWords?.slice(-20).join(', ') || 'none'}.`;
    
    const result = await generateContentWithRetry(model, prompt);
    res.json(JSON.parse(result.response.text()));
  } catch (error) {
    console.error("Batch Generate Error:", error.message);
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.get("/", (req, res) => {
  res.send("Render Gemini Relay is running");
});

app.listen(PORT, () => console.log(`🚀 Render Server running on port ${PORT}`));






