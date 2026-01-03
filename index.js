import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/genai";

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
  console.error("❌
