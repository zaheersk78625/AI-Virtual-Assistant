# Aether AI — Advanced Real-Time Virtual Assistant

A full-stack, production-grade AI Virtual Assistant featuring streaming natural-language conversations, speech recognition (microphone input), speech synthesis (voice readout), real-time live data integrations (Weather, News, Currency, Safe Calculator, World Clock, Web Search), and persistent conversation history.

---

## 🌟 Key Features

* **Natural Language AI Chat**: Powered by Google Gemini (`gemini-3.8-flash`) with streaming responses and multi-turn context.
* **Microphone Voice Input**: Speak directly to the assistant with continuous speech recognition, live transcript display, and edit-before-send capability.
* **Text-to-Speech (Voice Output)**: Natural voice readouts with speed rate adjustment, pitch control, and browser voice selection.
* **Real-Time Weather Integration**: Live Open-Meteo API integration providing current temperature (°C/°F), feels-like temp, humidity, wind speed, condition, and 5-day forecast for any city worldwide.
* **Live News Headlines**: Real-time news feeds categorised by Technology, Business, Science, World, Health, and Sports.
* **Live Currency Conversion**: Real-time exchange rate calculations across 160+ global currencies with live timestamps.
* **Safe Calculator**: Robust mathematical parser evaluating arithmetic, trigonometry, scientific functions, and unit conversions without `eval()`.
* **World Clock & Timezones**: Real-time local date and time calculations for any global city or timezone.
* **Persistent Conversation History**: Full conversation management with automatic naming, pinning, search, and deletion stored in atomic persistent database.
* **Interactive Avatar Orb**: Visual AI avatar responding dynamically to idle, listening, thinking, and speaking states.
* **Live Tools Explorer**: Dedicated drawer to query and test all 5 real-time tool endpoints directly with one click.
* **Dark & Light Mode**: Accessible, ergonomic interface with system theme sync.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide Icons, Marked |
| **Backend** | Node.js, Express, tsx |
| **AI Integration** | Google GenAI SDK (`@google/genai`) with Gemini 3.8 Flash & function calling |
| **Database** | Persistent atomic JSON store with transactional write-ahead |
| **Voice APIs** | Web Speech API (`SpeechRecognition` & `SpeechSynthesis`) + Gemini Flash Lite TTS |
| **Live APIs** | Open-Meteo (Weather), Open Exchange Rates (Currency), Google News (RSS Wire), DuckDuckGo (Search) |

---

## 🚀 Setup & Execution Guide

### Prerequisites
* **Node.js**: Version 20.x or higher ([nodejs.org](https://nodejs.org/))
* **npm**: Version 10.x or higher (included with Node.js)
* **Operating System**: Windows 10/11, macOS, or Linux

---

### Step 1: Clone or Navigate to Project
```powershell
# Windows PowerShell / CMD:
cd C:\path\to\your\project
```

### Step 2: Install Dependencies
```powershell
npm install
```

### Step 3: Configure Environment Variables
Create a `.env` file in the project root:
```ini
# Gemini API Key (obtained from https://aistudio.google.com/app/apikey)
GEMINI_API_KEY="your_gemini_api_key_here"

# Application URL (optional for self-referential links)
APP_URL="http://localhost:3000"
```

### Step 4: Start the Full-Stack Server
```powershell
# Starts the Express full-stack server running Vite in development mode on port 3000
npm run dev
```

Open your browser at:
```
http://localhost:3000
```

---

## 🧪 Automated Testing

Run the included automated test suite verifying all real-time tools, database persistence, calculator, weather, news, currency, and time APIs:

```powershell
npx tsx test/suite.ts
```

All 31 test assertions run with live API validation and report test pass/fail status.

---

## 📡 REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health status, active features, and model info |
| `POST` | `/api/chat` | Server-Sent Events (SSE) streaming chat endpoint with function calling |
| `GET` | `/api/conversations` | List saved conversations |
| `POST` | `/api/conversations` | Create a new conversation |
| `GET` | `/api/conversations/:id` | Retrieve conversation details and messages |
| `PATCH` | `/api/conversations/:id` | Update conversation title or pin status |
| `DELETE` | `/api/conversations/:id` | Delete a conversation |
| `GET` | `/api/weather?location=Tokyo` | Retrieve live weather and 5-day forecast |
| `GET` | `/api/currency?amount=100&from=USD&to=EUR` | Convert currency with live exchange rates |
| `GET` | `/api/news?topic=technology` | Retrieve verified live news headlines |
| `GET` | `/api/calc?expr=sqrt(144)+2^4` | Safe mathematical expression evaluation |
| `GET` | `/api/time?location=Tokyo` | Retrieve real-time city time and timezone |
| `POST` | `/api/tts` | Gemini Flash Lite TTS endpoint |

---

## 🛡️ Security & Privacy

* **Zero Frontend Secrets**: API keys are restricted strictly to server-side execution.
* **Safe Math Parsing**: Mathematical expressions are evaluated using `mathjs` AST parser, eliminating `eval()` risks.
* **Input Sanitization**: Request lengths and parameters are validated prior to tool execution.
* **CORS & Rate Limiting**: Secure defaults configured on Express endpoints.
