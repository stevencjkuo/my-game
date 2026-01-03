import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

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

const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);

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


