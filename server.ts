import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './server/db';
import {
  ai,
  MODEL_NAME,
  FALLBACK_MODELS,
  TTS_MODEL_NAME,
  toolsDefinition,
  executeTool,
  BASE_SYSTEM_INSTRUCTION,
} from './server/gemini';
import {
  fetchWeather,
  fetchNews,
  convertCurrency,
  getCurrentTime,
  safeCalculate,
  searchWeb,
} from './server/tools';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

// Health Check Endpoint
app.get('/api/health', (req: Request, res: Response) => {
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 5);
  const convList = db.listConversations();

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    aiProvider: 'Google Gemini 2.5/3.8 via @google/genai',
    model: MODEL_NAME,
    hasApiKey: hasGeminiKey,
    conversationsCount: convList.length,
    features: {
      streamingChat: true,
      voiceInput: true,
      textToSpeech: true,
      liveWeather: true,
      liveNews: true,
      liveCurrency: true,
      safeCalculator: true,
      timezones: true,
      webSearch: true,
    },
  });
});

// Conversations CRUD
app.get('/api/conversations', (req: Request, res: Response) => {
  try {
    const list = db.listConversations();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/conversations', (req: Request, res: Response) => {
  try {
    const title = req.body.title;
    const conv = db.createConversation(title);
    res.status(201).json(conv);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/conversations/:id', (req: Request, res: Response) => {
  try {
    const conv = db.getConversation(req.params.id);
    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json(conv);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/conversations/:id', (req: Request, res: Response) => {
  try {
    const updated = db.updateConversation(req.params.id, {
      title: req.body.title,
      pinned: req.body.pinned,
    });
    if (!updated) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/conversations/:id', (req: Request, res: Response) => {
  try {
    const deleted = db.deleteConversation(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json({ success: true, message: 'Conversation deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Direct Tool Endpoints
app.get('/api/weather', async (req: Request, res: Response) => {
  try {
    const location = (req.query.location as string) || 'London';
    const data = await fetchWeather(location);
    res.json(data);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/news', async (req: Request, res: Response) => {
  try {
    const topic = (req.query.topic as string) || 'technology';
    const data = await fetchNews(topic);
    res.json(data);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/currency', async (req: Request, res: Response) => {
  try {
    const amount = Number(req.query.amount) || 1;
    const from = (req.query.from as string) || 'USD';
    const to = (req.query.to as string) || 'EUR';
    const data = await convertCurrency(amount, from, to);
    res.json(data);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/calc', (req: Request, res: Response) => {
  try {
    const expr = (req.query.expr as string) || '';
    const data = safeCalculate(expr);
    res.json(data);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/time', (req: Request, res: Response) => {
  try {
    const location = req.query.location as string;
    const data = getCurrentTime(location);
    res.json(data);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/search', async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string) || '';
    if (!query) return res.status(400).json({ error: 'Search query parameter q is required' });
    const results = await searchWeb(query);
    res.json({ query, results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Gemini TTS API
app.post('/api/tts', async (req: Request, res: Response) => {
  try {
    const { text, voiceName = 'Kore' } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required for TTS' });
    }

    const ttsResponse = await ai.models.generateContent({
      model: TTS_MODEL_NAME,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: text.slice(0, 500), // Keep TTS chunks snappy
              speechMetadata: {
                style: 'Clear, natural, professional AI assistant',
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName as any },
          },
        },
      },
    });

    const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      return res.status(500).json({ error: 'No audio data returned from model' });
    }

    res.json({
      audioBase64: base64Audio,
      mimeType: 'audio/wav',
    });
  } catch (err: any) {
    console.error('[TTS Error]', err);
    res.status(500).json({ error: err.message || 'TTS generation failed' });
  }
});

// Real-Time Streaming Chat with Function Calling and Tool Execution
app.post('/api/chat', async (req: Request, res: Response) => {
  const { conversationId: rawConvId, message, persona } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Message content cannot be empty.' });
  }

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendSSE = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  let conversationId = rawConvId;
  let conv = conversationId ? db.getConversation(conversationId) : null;
  if (!conv) {
    conv = db.createConversation();
    conversationId = conv.id;
  }

  // Save User message
  const userMsg = db.addMessage(conversationId, {
    role: 'user',
    content: message.trim(),
  });

  sendSSE('conversation_init', {
    conversationId,
    userMessage: userMsg,
  });

  // Build persona instructions
  let systemInstruction = BASE_SYSTEM_INSTRUCTION;
  if (persona === 'technical') {
    systemInstruction += '\nPersona: Technical Specialist. Provide deep engineering analysis, algorithmic details, and production-grade code.';
  } else if (persona === 'concise') {
    systemInstruction += '\nPersona: Executive. Be extremely crisp, high-signal, bulleted, and direct.';
  } else if (persona === 'creative') {
    systemInstruction += '\nPersona: Creative Partner. Be inspiring, articulate, vivid, and exploratory.';
  }

  // Build message history
  const recentMessages = conv.messages.slice(-12);
  const formattedContents: any[] = recentMessages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const toolInvocations: Array<{
    name: string;
    args?: Record<string, unknown>;
    result?: unknown;
    state?: 'calling' | 'complete' | 'error';
  }> = [];

  try {
    let accumulatedText = '';

    // Function to attempt generation with fallback models
    let response1: any = null;
    let selectedModel = MODEL_NAME;
    let lastError: any = null;

    for (const modelToTry of FALLBACK_MODELS) {
      try {
        sendSSE('status', { message: 'Thinking...' });
        response1 = await ai.models.generateContent({
          model: modelToTry,
          contents: formattedContents,
          config: {
            systemInstruction,
            tools: toolsDefinition,
            toolConfig: { includeServerSideToolInvocations: true },
          },
        });
        selectedModel = modelToTry;
        break; // Succeeded
      } catch (err: any) {
        lastError = err;
        // Continue to try next fallback model
        continue;
      }
    }

    if (!response1) {
      // Models encountered error (e.g. temporary API quota limit)
      // Execute intelligent direct tool fallback
      
      // Check if message matches real-time tool intent directly
      const lower = message.toLowerCase();
      let handledByTool = false;

      // 1. Weather Intent
      if (lower.includes('weather') || lower.includes('temperature') || lower.includes('forecast')) {
        const words = message.replace(/[?,.!]/g, '').split(/\s+/);
        const inIndex = words.findIndex((w) => ['in', 'for', 'at'].includes(w.toLowerCase()));
        const loc = inIndex !== -1 && words[inIndex + 1] ? words.slice(inIndex + 1).join(' ') : 'Tokyo';
        
        sendSSE('tool_call', { name: 'getWeather', args: { location: loc } });
        toolInvocations.push({ name: 'getWeather', args: { location: loc }, state: 'calling' });

        try {
          const w = await fetchWeather(loc);
          sendSSE('tool_result', { name: 'getWeather', result: w });
          toolInvocations[toolInvocations.length - 1].result = w;
          toolInvocations[toolInvocations.length - 1].state = 'complete';

          accumulatedText = `### 🌤️ Weather for ${w.city}, ${w.country}\n\n` +
            `* **Current Temperature**: ${w.current.temperatureC}°C (${w.current.temperatureF}°F)\n` +
            `* **Condition**: ${w.current.condition}\n` +
            `* **Feels Like**: ${w.current.feelsLikeC}°C\n` +
            `* **Humidity**: ${w.current.humidity}%\n` +
            `* **Wind Speed**: ${w.current.windSpeedKmh} km/h\n\n` +
            `#### 5-Day Forecast:\n` +
            w.forecast.map((f) => `* **${f.date}**: ${f.condition}, High ${f.maxTempC}°C / Low ${f.minTempC}°C`).join('\n') +
            `\n\n*(Live data retrieved directly from Open-Meteo)*`;
          handledByTool = true;
        } catch (e: any) {
          console.error('[Fallback Weather Error]', e);
        }
      }

      // 2. Currency Intent
      if (!handledByTool && (lower.includes('convert') || lower.includes('exchange') || lower.includes('usd') || lower.includes('eur') || lower.includes('currency'))) {
        const numMatch = message.match(/(\d+(\.\d+)?)/);
        const amount = numMatch ? parseFloat(numMatch[1]) : 100;
        let fromCurr = 'USD';
        let toCurr = 'EUR';

        const currCodes = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR'];
        for (const c of currCodes) {
          if (new RegExp(`\\b${c}\\b`, 'i').test(message)) {
            if (fromCurr === 'USD') fromCurr = c;
            else toCurr = c;
          }
        }

        sendSSE('tool_call', { name: 'convertCurrency', args: { amount, from: fromCurr, to: toCurr } });
        toolInvocations.push({ name: 'convertCurrency', args: { amount, from: fromCurr, to: toCurr }, state: 'calling' });

        try {
          const c = await convertCurrency(amount, fromCurr, toCurr);
          sendSSE('tool_result', { name: 'convertCurrency', result: c });
          toolInvocations[toolInvocations.length - 1].result = c;
          toolInvocations[toolInvocations.length - 1].state = 'complete';

          accumulatedText = `### 💱 Live Currency Conversion\n\n` +
            `* **Amount**: ${c.amount} ${c.from}\n` +
            `* **Converted Value**: **${c.convertedAmount.toLocaleString()} ${c.to}**\n` +
            `* **Live Rate**: 1 ${c.from} = ${c.rate} ${c.to}\n` +
            `* **Last Updated**: ${c.lastUpdated}\n\n` +
            `*(Live exchange rates from Open Exchange Rates)*`;
          handledByTool = true;
        } catch (e: any) {
          console.error('[Fallback Currency Error]', e);
        }
      }

      // 3. Calculator Intent
      if (!handledByTool && (lower.includes('calculate') || lower.includes('math') || /[\d\s+\-*/^()=]+/.test(message))) {
        const expr = message.replace(/calculate|math|what is|compute/gi, '').trim();
        if (expr.length > 1) {
          try {
            const mathRes = safeCalculate(expr);
            sendSSE('tool_call', { name: 'calculateMath', args: { expression: expr } });
            toolInvocations.push({ name: 'calculateMath', args: { expression: expr }, state: 'calling' });
            sendSSE('tool_result', { name: 'calculateMath', result: mathRes });
            toolInvocations[toolInvocations.length - 1].result = mathRes;
            toolInvocations[toolInvocations.length - 1].state = 'complete';

            accumulatedText = `### 🧮 Mathematical Calculation\n\n` +
              `$$\n${mathRes.formatted}\n$$\n\n` +
              `* **Result**: **${mathRes.result}**\n` +
              `*(Calculated safely using precision math parsing)*`;
            handledByTool = true;
          } catch {}
        }
      }

      // 4. Time Intent
      if (!handledByTool && (lower.includes('time') || lower.includes('date') || lower.includes('clock') || lower.includes('timezone'))) {
        const words = message.replace(/[?,.!]/g, '').split(/\s+/);
        const inIndex = words.findIndex((w) => ['in', 'for', 'at'].includes(w.toLowerCase()));
        const loc = inIndex !== -1 && words[inIndex + 1] ? words.slice(inIndex + 1).join(' ') : 'local';

        sendSSE('tool_call', { name: 'getCurrentTime', args: { location: loc } });
        toolInvocations.push({ name: 'getCurrentTime', args: { location: loc }, state: 'calling' });

        const t = getCurrentTime(loc);
        sendSSE('tool_result', { name: 'getCurrentTime', result: t });
        toolInvocations[toolInvocations.length - 1].result = t;
        toolInvocations[toolInvocations.length - 1].state = 'complete';

        accumulatedText = `### 🕒 Real-Time World Clock\n\n` +
          `* **Location**: ${t.location} (${t.timezone})\n` +
          `* **Local Time**: **${t.localTime}**\n` +
          `* **Date**: ${t.dayOfWeek}, ${t.date}\n` +
          `* **UTC Offset**: ${t.utcOffset}\n`;
        handledByTool = true;
      }

      // 5. News Intent
      if (!handledByTool && (lower.includes('news') || lower.includes('headline') || lower.includes('articles'))) {
        sendSSE('tool_call', { name: 'getNews', args: { topic: 'technology' } });
        toolInvocations.push({ name: 'getNews', args: { topic: 'technology' }, state: 'calling' });

        try {
          const n = await fetchNews('technology');
          sendSSE('tool_result', { name: 'getNews', result: n });
          toolInvocations[toolInvocations.length - 1].result = n;
          toolInvocations[toolInvocations.length - 1].state = 'complete';

          accumulatedText = `### 📰 Latest News Headlines\n\n` +
            n.articles.slice(0, 5).map((a, i) => `${i + 1}. **[${a.title}](${a.link})** — *${a.source}* (${a.publishedAt.slice(0, 16)})`).join('\n') +
            `\n\n*(Retrieved directly from live news feeds)*`;
          handledByTool = true;
        } catch {}
      }

      // If not a tool query, provide a clear, helpful explanation of the 429 quota rate limit
      if (!handledByTool) {
        accumulatedText = `### ⚠️ Gemini API Rate Limit / Quota Notice\n\n` +
          `The Gemini API returned a temporary \`429 RESOURCE_EXHAUSTED\` rate limit on your current API quota.\n\n` +
          `**What you can do:**\n` +
          `* **Wait 1 minute**: Free-tier rate limits reset automatically every minute.\n` +
          `* **Use Live Tools**: All real-time tools (**Weather**, **Currency Converter**, **Calculator**, **World Clock**, **Live News**) are 100% active and functioning without requiring Gemini quota. You can try queries like:\n` +
          `  - *"What's the weather in Paris?"*\n` +
          `  - *"Convert 250 USD to EUR"*\n` +
          `  - *"Calculate 1000 * (1 + 0.05)^4"*\n` +
          `  - *"What time is it in Tokyo?"*\n` +
          `  - *"Show me tech news"*\n` +
          `* Click the **Tools Explorer** in the top navigation bar to explore any tool directly.\n\n` +
          `*(Original error: ${lastError?.message || 'Quota rate limit reached'})*`;
      }

      sendSSE('token', { text: accumulatedText });
    } else {
      // Model responded successfully! Process function calls or text
      const functionCalls = response1.functionCalls;

      if (functionCalls && functionCalls.length > 0) {
        const toolResultsParts: any[] = [];

        for (const fc of functionCalls) {
          if (!fc.name) continue;
          const toolName: string = fc.name;
          const toolArgs = (fc.args as Record<string, any>) || {};

          sendSSE('tool_call', {
            name: toolName,
            args: toolArgs,
          });

          toolInvocations.push({
            name: toolName,
            args: toolArgs,
            state: 'calling',
          });

          try {
            const toolResult = await executeTool(toolName, toolArgs);

            sendSSE('tool_result', {
              name: toolName,
              result: toolResult,
            });

            const lastInvocation = toolInvocations[toolInvocations.length - 1];
            if (lastInvocation) {
              lastInvocation.result = toolResult;
              lastInvocation.state = 'complete';
            }

            toolResultsParts.push({
              functionResponse: {
                name: toolName,
                response: { output: toolResult },
              },
            });
          } catch (toolErr: any) {
            console.error(`[Tool Error] ${toolName}:`, toolErr);
            const errorMsg = toolErr.message || 'Execution error';

            sendSSE('tool_result', {
              name: toolName,
              error: errorMsg,
            });

            const lastInvocation = toolInvocations[toolInvocations.length - 1];
            if (lastInvocation) {
              lastInvocation.result = { error: errorMsg };
              lastInvocation.state = 'error';
            }

            toolResultsParts.push({
              functionResponse: {
                name: toolName,
                response: { error: errorMsg },
              },
            });
          }
        }

        // Step 2: Stream second pass with function execution responses
        sendSSE('status', { message: 'Synthesizing response with live data...' });

        const candidateContent = response1.candidates?.[0]?.content;
        const followUpContents = [
          ...formattedContents,
          candidateContent || { role: 'model', parts: [{ text: '' }] },
          {
            role: 'user',
            parts: toolResultsParts,
          },
        ];

        try {
          const streamResponse = await ai.models.generateContentStream({
            model: selectedModel,
            contents: followUpContents,
            config: {
              systemInstruction,
            },
          });

          for await (const chunk of streamResponse) {
            const text = chunk.text;
            if (text) {
              accumulatedText += text;
              sendSSE('token', { text });
            }
          }
        } catch (streamErr: any) {
          console.warn('[Stream 2nd pass fallback]', streamErr.message);
          // If streaming second pass hit rate limit, format the tool results directly
          accumulatedText = `### Live Tool Execution Results\n\n` +
            toolInvocations.map((ti) => `* **${ti.name}**: \n\`\`\`json\n${JSON.stringify(ti.result, null, 2)}\n\`\`\``).join('\n\n');
          sendSSE('token', { text: accumulatedText });
        }
      } else {
        // No function calls: use text directly or stream
        const text = response1.text;
        if (text) {
          accumulatedText = text;
          sendSSE('token', { text });
        }
      }
    }

    if (!accumulatedText) {
      accumulatedText = "I have processed your request, but received no text output. Please try rephrasing.";
      sendSSE('token', { text: accumulatedText });
    }

    // Save assistant message to database
    const assistantMsg = db.addMessage(conversationId, {
      role: 'assistant',
      content: accumulatedText,
      toolInvocations: toolInvocations.length > 0 ? toolInvocations : undefined,
    });

    sendSSE('done', {
      conversationId,
      message: assistantMsg,
    });
  } catch (err: any) {
    console.error('[Chat Generation Error]', err);
    sendSSE('error', {
      message: err.message || 'An error occurred while generating response.',
    });
  } finally {
    res.end();
  }
});

// Setup Vite dev server or static files
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[Aether AI Server] Running on http://localhost:${PORT}`);
  });
}

startServer();
