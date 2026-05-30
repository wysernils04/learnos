# LearnOS

Spaced-repetition learning web app for university students. Multi-user, production-ready.
Core: SuperMemo-2 algorithm (identical to Anki), semantic full-text search over uploaded PDFs/audio, auto quiz generation via Anthropic Claude API, exam readiness scoring, cognitive load protection.

## Skills & Design System

Before writing ANY frontend code, component, or page, always load and follow:
- @ui-ux-pro-max-skill (for all UI/UX decisions, components, and design)

This applies to every React component, page, layout, and Tailwind class.

## Tech Stack (non-negotiable)

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router) + TypeScript strict mode |
| UI | Tailwind CSS + shadcn/ui |
| State | Zustand (client) + React Query (server) |
| Auth | Supabase Auth (Email + Google OAuth) |
| Database | Supabase PostgreSQL + pgvector |
| Storage | Supabase Storage (PDFs, audio) |
| Backend | FastAPI (Python 3.11+) on Railway |
| Embeddings | sentence-transformers `paraphrase-multilingual-MiniLM-L12-v2` (384-dim) |
| Audio | OpenAI Whisper (tiny, on-demand) |
| PDF | pdfplumber |
| LLM | Anthropic Claude API (`claude-sonnet-4-20250514`) |
| Hosting | Vercel (frontend) + Railway (backend) |

## Architecture

```
Browser (Next.js)
    │
    ├── /api/* (Next.js API Routes) ← Auth, simple reads
    │
    └── FastAPI Backend (Railway)
            ├── /topics, /quiz, /flashcards, /exams ...
            ├── /files/upload → Supabase Storage → indexing
            ├── /search/semantic → pgvector cosine similarity
            └── /generate/quiz → Anthropic API
                    └── Supabase PostgreSQL (pgvector)
```

Users bring their own Anthropic API key. Stored encrypted with `cryptography.fernet` (key = Supabase JWT secret). Never exposed to frontend.

## Directory Structure

```
frontend/
├── app/
│   ├── (auth)/login  (auth)/register
│   └── (app)/dashboard  queue  topics  flashcards  exams  files  analytics  settings
├── components/
│   ├── ui/                    # shadcn/ui
│   ├── ReviewCard.tsx         # SM-2 review with quality buttons 0–5
│   ├── ReadinessGauge.tsx     # semicircular gauge 0–100%
│   ├── StreakCalendar.tsx      # GitHub-style heatmap
│   ├── ScoreSlider.tsx        # understanding 1–5
│   ├── FileUploadZone.tsx     # drag-and-drop
│   └── SemanticSearchBar.tsx
└── lib/
    ├── api.ts        # typed API client (all endpoints)
    ├── supabase.ts
    └── store.ts      # Zustand stores

backend/
├── main.py
├── core/
│   ├── auth.py         # JWT validation against Supabase
│   ├── database.py     # Supabase client
│   ├── algorithms.py   # _sm2(), _readiness(), _chunk_text()
│   └── config.py       # pydantic-settings
├── routers/
│   topics.py  queue.py  quiz.py  flashcards.py  files.py
│   exams.py  sessions.py  analytics.py  sbb.py
├── services/
│   embeddings.py  llm.py  whisper_service.py  pdf_service.py
└── models/schemas.py
```

## Core Algorithms (copy verbatim — do not reinvent)

```python
# SuperMemo-2 (Wozniak 1987)
def _sm2(ef: float, interval: int, reps: int, quality: int) -> tuple[float, int, int]:
    if quality < 3:
        reps, interval = 0, 1
    else:
        interval = 1 if reps == 0 else (6 if reps == 1 else round(interval * ef))
        reps += 1
    ef = max(1.3, ef + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    return round(ef, 3), interval, reps

# SM-2 quality ← score_percent mapping
# < 40% → 1 | 40–55% → 2 | 55–70% → 3 | 70–85% → 4 | > 85% → 5

# Readiness weights: understanding 35% | quiz performance 40% | timing 25%
u_pts = (score / 5) * 35
q_pts = ((avg_quiz or 0) / 100) * 40
t_pts = 25 if next_due <= exam else max(0, 25 - (next_due - exam).days * 3)

# Ebbinghaus: first review interval
memory_strength = float(understanding_score) * 2.0
days = max(1, round(memory_strength * math.log(1 / 0.7)))

# Cognitive load: 60 points per calendar event, max 300 points/day
```

## Coding Rules

- TypeScript **strict mode** — no `any` types
- **Pydantic v2** for all API models
- **async/await** everywhere — no blocking calls
- **RLS on every Supabase table** — `auth.uid() = user_id` policy
- Never accept `user_id` from frontend — always extract from JWT
- Optimistic updates on review flow
- Every protected FastAPI endpoint: `user = Depends(get_current_user)`
- Uniform API response shape: `{ "data": {...}, "error": null }` / `{ "data": null, "error": "..." }`
- Error boundaries in frontend for every critical block
- API keys never in frontend code or logs

## What NOT To Use

- No Redux (Zustand only)
- No Express/Node backend (FastAPI only)
- No CSS-in-JS (Tailwind only)
- No other database (Supabase/PostgreSQL only)
- No own auth server (Supabase Auth only)
- No synchronous DB calls in backend

## Implementation Order

```
Phase 1 – Foundation:  Supabase setup (Auth/DB/RLS/pgvector) → FastAPI skeleton →
                       Next.js + Supabase Auth → /topics CRUD → deploy Railway+Vercel

Phase 2 – Core Loop:   get_learning_queue → SM-2 review flow (ReviewCard.tsx) →
                       daily briefing dashboard → streak + heatmap

Phase 3 – Features:    file upload → pgvector embeddings → semantic search →
                       flashcards SM-2 → exams + readiness → auto-quiz → sessions

Phase 4 – Polish:      analytics charts (Recharts) → export → SBB integration →
                       PWA → audio + Whisper
```

## Environment Variables

```bash
# backend/.env
SUPABASE_URL=
SUPABASE_SERVICE_KEY=   # service_role (backend only!)
FERNET_SECRET=
CORS_ORIGINS=https://learnos.vercel.app

# frontend/.env.local
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=https://api.learnos.railway.app
```
