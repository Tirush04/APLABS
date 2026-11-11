import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

function getGeminiClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === 'MY_GEMINI_API_KEY' || key.trim() === '') return null;
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// System instruction enforcing strict data-only compliance
const BASE_SYSTEM_INSTRUCTION = `You are the AI assistant for "DC STR Advisor", a short-term rental pricing advisory system for Washington, DC.
CRITICAL MANDATORY RULES:
1. You must ONLY answer using numbers provided in the JSON context object (CONTEXT).
2. NEVER generate, estimate, assume, or fabricate any numbers, percentages, counts, or dollar figures from general knowledge.
3. If asked about a number, trend, or question that cannot be answered strictly from CONTEXT, you must explicitly state: "That isn't in the data" and suggest which tab (Property Profile, Price Recommendation, Revenue & Break-even, Booking Outlook, Amenity Premium, Neighbourhood Explorer, or Competition) could compute it.
4. When citing any number from CONTEXT, quote the exact number and mention its metric name or provenance.
5. Keep answers concise, direct, and under 80 words.
6. Format key numbers in bold.`;

// Endpoint: Chat with streaming SSE
app.post('/api/gemini/chat', async (req, res) => {
  try {
    const { message, contextJson } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error: 'Gemini API key is not configured. AI explanations are currently disabled, but all calculated analytics remain fully functional.',
      });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const prompt = `CONTEXT JSON (Calculated from DC listings dataset):
${JSON.stringify(contextJson, null, 2)}

USER QUESTION:
${message}`;

    const stream = await ai.models.generateContentStream({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: BASE_SYSTEM_INSTRUCTION,
      },
    });

    for await (const chunk of stream) {
      const text = chunk.text || '';
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error: any) {
    console.error('Gemini chat error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error?.message || 'Gemini streaming error' });
    } else {
      res.write(`data: ${JSON.stringify({ error: error?.message || 'Error generating response' })}\n\n`);
      res.end();
    }
  }
});

// Endpoint: Explain this to my client (2 sentences)
app.post('/api/gemini/explain', async (req, res) => {
  try {
    const { screenName, contextJson } = req.body;
    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error: 'Gemini API key is not configured.',
      });
    }

    const prompt = `You are advising a DC homeowner during an in-person meeting.
Screen context: ${screenName || 'General STR Performance'}
Computed numbers:
${JSON.stringify(contextJson, null, 2)}

Write exactly 2 warm, confident, owner-friendly sentences explaining these specific computed results.
Do not introduce any numbers not present in the JSON above. Keep it strictly grounded in the computed data.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: BASE_SYSTEM_INSTRUCTION,
      },
    });

    res.json({ text: response.text?.trim() || '' });
  } catch (error: any) {
    console.error('Gemini explain error:', error);
    res.status(500).json({ error: error?.message || 'Error generating explanation' });
  }
});

// Endpoint: Client Brief 3-sentence narrative
app.post('/api/gemini/brief-narrative', async (req, res) => {
  try {
    const { contextJson } = req.body;
    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error: 'Gemini API key is not configured.',
      });
    }

    const prompt = `Write a 3-sentence executive summary for the printable Client Brief.
Computed property metrics:
${JSON.stringify(contextJson, null, 2)}

Sentence 1: State the recommended nightly pricing and typical market range for their neighbourhood and property type.
Sentence 2: State the expected annual booked nights and estimated median annual revenue.
Sentence 3: Provide a strategic recommendation on launching (e.g. launch tier vs market tier) or key amenities based only on the numbers above.
Quote only numbers from the JSON above. Never invent numbers.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: BASE_SYSTEM_INSTRUCTION,
      },
    });

    res.json({ text: response.text?.trim() || '' });
  } catch (error: any) {
    console.error('Gemini brief error:', error);
    res.status(500).json({ error: error?.message || 'Error generating brief narrative' });
  }
});

// Static files / Vite middleware
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`DC STR Advisor server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
