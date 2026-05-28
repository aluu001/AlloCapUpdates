import dotenv from 'dotenv';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

// Load environment variables from .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PORT = parseInt(process.env.PORT || '5001', 10);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// Instantiate GoogleGenAI client
// If API key is empty/placeholder, we still instantiate it but will handle validation in route requests
const ai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE' ? '' : GEMINI_API_KEY,
});

export const config = {
  port: PORT,
  geminiApiKey: GEMINI_API_KEY,
  isApiConfigured: GEMINI_API_KEY !== '' && GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE',
  storageDir: path.resolve(__dirname, '../storage'),
};

export { ai };
