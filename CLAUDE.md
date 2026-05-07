# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

QuizCraft CN is a Chinese quiz/study system with three components:
- **`server.py`** — FastAPI backend (single ~1900-line file)
- **`web-app/`** — React + TypeScript + Vite frontend
- **`electron-app/`** — Optional Electron shell wrapping the web app
- **`tiku/`** — Question bank JSON data files
- **`llm_service.py`** — Async LLM service for AI-generated explanations

## Commands

### Development (start both backend and frontend)
```bash
./start.sh
```

### Run backend only
```bash
python3 server.py
# or with explicit host/port:
APP_HOST=0.0.0.0 APP_PORT=10086 python3 server.py
```

### Run frontend only
```bash
cd web-app
npm install --include=dev
npm run dev          # dev mode (all features, http://localhost:5173)
npm run dev:ops      # ops mode (restricted features)
```

### Lint
```bash
cd web-app && npm run lint
```

### Production build
```bash
cd web-app
npm run build        # full build
npm run build:ops    # ops build (reads .env.ops)
npm run preview:ops  # serve the ops build locally
```

### Ops environment (build + serve backend + serve static frontend)
```bash
./start_ops.sh
```

### Electron desktop app
```bash
# Start backend + web-app dev server first, then:
cd electron-app && npm install && npm run dev
```

There is no test suite in this repository.

## Architecture

### Backend (`server.py`)
All API logic lives in a single file. On startup it loads question banks from `tiku/*.json` into an in-memory dict `QUESTION_BANKS`. Three banks are hard-coded (sixiu, xigai, history) and any additional `tiku/*.json` files are auto-discovered.

**Persistent state files** (written next to `server.py`):
- `rankings_v2.json` — user scores / leaderboard
- `question_stats.json` — per-question answer statistics

**Key endpoints:**
| Route | Purpose |
|---|---|
| `GET /api/banks` | List all question banks |
| `POST /api/practice/start` | Begin a practice session, returns question list |
| `POST /api/practice/submit` | Submit an answer, returns correctness + stats |
| `POST /api/user` | Get or create user (persists userId in localStorage on frontend) |
| `GET /api/ranking` | Leaderboard |
| `POST /api/extract/parse` | Upload PDF/Word/TXT, parse into questions |
| `POST /api/extract/analyze` | Generate AI explanations via LLM |
| `POST /api/extract/export` | Export questions to downloadable JSON |
| `POST /api/banks/save` | Save extracted questions as a new bank in `tiku/` |
| `WS /ws/analyze/{client_id}` | WebSocket for real-time analysis progress |

The backend accepts `APP_HOST`, `APP_PORT`, or the platform-injected `PORT` env var.

### Frontend (`web-app/src/`)
React Router v6 with a single `<Layout>` outlet. All pages share the same nav shell.

**Routing:**
- `/` — Home (bank selector, hidden in ops mode → redirects to `/practice`)
- `/practice` — Mode selector (random / chapter / hard)
- `/quiz` — Active quiz session
- `/result` — Session summary
- `/ranking` — Leaderboard
- `/extract` — Question bank workshop (hidden in ops mode)
- `/beetle` — BeetleFight multiplayer mode

**State management:** Zustand store (`useQuizStore`) with `persist` middleware. Persisted slice (localStorage key `quiz-storage`) includes: `currentBank`, `user`, `history`, `wrongQuestions`, `starredQuestions`. The `practice` state is intentionally not persisted.

**API client (`src/api/client.ts`):** Axios wrapper. In normal browser context the base URL is `/api` (proxied by Vite dev server to `http://127.0.0.1:10086`). In Electron or `file://` context it uses the full absolute URL `http://127.0.0.1:10086/api`. WebSocket URLs follow the same pattern via `buildWebSocketURL()`.

**Path alias:** `@` resolves to `web-app/src/`.

### Build Modes (dev vs ops)
`IS_OPS_MODE` (`src/config/appMode.ts`) is true when `VITE_APP_MODE=ops`. This flag:
- Hides Home and Extract pages (redirects to `/practice`)
- Changes the nav to only show Practice, Ranking, BeetleFight
- Sets the API base to `/api` (same-origin, for reverse-proxy deployment)

Ops build uses `web-app/.env.ops` which sets `VITE_APP_MODE=ops` and `VITE_API_BASE_URL=/api`.

### Question Bank JSON Format
```json
{
  "meta": { "name": "...", "total": 100, "created_at": "..." },
  "questions": [
    {
      "id": "q0001",
      "type": "single",        // "single" | "multi" | "judge"
      "chapter": "第一章",
      "chapter_id": "ch01",
      "content": "题目文本",
      "options": ["A", "B", "C", "D"],   // omitted for judge questions
      "answer": 0,             // single: index; multi: [0,1,...]; judge: true/false
      "analysis": "解析文本",
      "stats": { "total": 100, "correct": 80, "rate": 80 }
    }
  ]
}
```
The server normalizes legacy formats on load; do not assume all loaded questions match this exact shape.

### LLM Service (`llm_service.py`)
Supports OpenAI, DeepSeek, and SiliconFlow providers. `LLMService.generate_analysis_batch()` uses `asyncio.Semaphore` to cap concurrency (`max_concurrent`, default 5). Multiple API keys can be passed as comma/newline-separated strings and are round-robin rotated. The frontend calls `/api/extract/analyze` which triggers this service; progress is streamed via the WebSocket.

## Deployment Notes
For ops deployment behind Nginx/Caddy:
- Proxy `/api` and `/ws` to backend port (default 10086)
- Serve frontend static files from `/`

Environment variables for `start_ops.sh`: `BACKEND_PORT`, `FRONTEND_PORT`, `PYTHON_BIN`, `STATIC_DEPLOY_DIR`.
