import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '50kb' }));

const PORT = process.env.PORT || 3000;
const GEMINI_MODEL = 'gemini-3.8-flash';

// In-memory rate limiter: 20 requests per 5 minutes per IP on /api/gemini/*
interface RateLimitRecord {
  count: number;
  resetTime: number;
}
const rateLimitMap = new Map<string, RateLimitRecord>();
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_REQUESTS_PER_WINDOW = 20;

function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown-ip';
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    const waitMins = Math.ceil((record.resetTime - now) / 60000);
    return res.status(429).json({
      error: `Rate limit reached (maximum 20 requests per 5 minutes). Please try again in about ${waitMins} minute(s). All underlying market calculations continue to work normally.`,
    });
  }

  record.count += 1;
  return next();
}

app.use('/api/gemini/*', rateLimitMiddleware);

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

// Health check endpoint
app.get('/api/health', (_req, res) => {
  const ai = getGeminiClient();
  res.json({
    ai: ai !== null,
    model: GEMINI_MODEL,
  });
});

// Middleware for payload size enforcement (message > 500 chars, contextJson > 20 KB)
function validatePayload(req: Request, res: Response, next: NextFunction) {
  const { message, contextJson } = req.body;
  if (message && typeof message === 'string' && message.length > 500) {
    return res.status(413).json({
      error: 'Message exceeds maximum allowed length of 500 characters.',
    });
  }

  if (contextJson) {
    const bytes = Buffer.byteLength(JSON.stringify(contextJson), 'utf8');
    if (bytes > 20 * 1024) {
      return res.status(413).json({
        error: 'Context payload exceeds maximum size of 20 KB.',
      });
    }
  }

  return next();
}

// Endpoint: Chat with streaming SSE and last 4 turns history
app.post('/api/gemini/chat', validatePayload, async (req, res) => {
  try {
    const { message, contextJson, history = [] } = req.body;
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

    // Build chat contents taking last 4 turns if provided
    const recentHistory = Array.isArray(history) ? history.slice(-4) : [];
    const formattedHistory = recentHistory.map((item: any) => ({
      role: item.role === 'user' ? 'user' : 'model',
      parts: [{ text: item.text || '' }],
    }));

    const currentPrompt = `CONTEXT JSON (Calculated from DC listings dataset):
${JSON.stringify(contextJson, null, 2)}

USER QUESTION:
${message}`;

    const stream = await ai.models.generateContentStream({
      model: GEMINI_MODEL,
      contents: [
        ...formattedHistory,
        { role: 'user', parts: [{ text: currentPrompt }] },
      ],
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
app.post('/api/gemini/explain', validatePayload, async (req, res) => {
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
      model: GEMINI_MODEL,
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
app.post('/api/gemini/brief-narrative', validatePayload, async (req, res) => {
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
Sentence 3: Provide a strategic recommendation on launching or key amenities based only on the numbers above.
Quote only numbers from the JSON above. Never invent numbers.`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
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
