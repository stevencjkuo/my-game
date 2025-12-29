import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

/**
 * 只允許你的 GitHub Pages
 */
app.use(cors({
  origin: ["http://127.0.0.1:5500", "http://localhost:5500", "https://stevencjkuo.github.io/my-english-app/"]
}));

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Gemini Relay Server is running 🚀");
});

/**
 * Gemini 中繼 API
 */
app.post("/api/gemini", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

    // 確保 URL 格式完全正確
    const apiUrl = `${process.env.GEMINI_API_URL}?key=${process.env.GEMINI_API_KEY}`;

    const response = await axios.post(apiUrl, 
      {
        contents: [{ parts: [{ text: prompt }] }]
      },
      {
        headers: { "Content-Type": "application/json" }
      }
    );

    res.json(response.data);

  } catch (err) {
    // 輸出詳細錯誤到控制台方便排查
    console.error("Gemini Error:", err.response?.data || err.message);
    res.status(500).json({
      error: "Gemini relay failed",
      message: err.response?.data || err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Gemini relay listening on port ${PORT}`);
});
