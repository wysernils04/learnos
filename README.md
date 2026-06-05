# LearnOS

Spaced-repetition learning app for university students. Upload your lecture PDFs and audio, get auto-generated quizzes, track exam readiness, and review flashcards using the SuperMemo-2 algorithm — the same algorithm used by Anki.

**Live at [learnos.ch](https://learnos.ch)**

---

## Features

- **SM-2 review queue** — daily learning queue with cognitive load protection
- **Flashcards** — SM-2 spaced repetition with quality ratings 0–5
- **Auto quiz generation** — Claude AI generates MCQ/true-false questions from your uploaded files
- **Exam readiness score** — weighted score based on understanding (35%), quiz performance (40%), and timing (25%)
- **Semantic search** — pgvector cosine similarity search over uploaded PDFs and audio transcripts
- **File processing** — PDF text extraction (pdfplumber) + audio transcription (Whisper tiny)
- **Analytics** — streak calendar, module breakdown, quiz history, study session tracking, CSV export
- **SBB integration** — Swiss public transport connections for study slot planning
- **PWA** — installable on mobile

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router) + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| State | Zustand + TanStack Query |
| Auth | Supabase Auth (Email + Google OAuth) |
| Database | Supabase PostgreSQL + pgvector |
| Storage | Supabase Storage |
| Backend | FastAPI (Python 3.11+) on Railway |
| Embeddings | `paraphrase-multilingual-MiniLM-L12-v2` (384-dim, multilingual) |
| Audio | OpenAI Whisper tiny |
| PDF | pdfplumber |
| LLM | Anthropic Claude API (user's own key) |
| Hosting | Vercel (frontend) + Railway (backend) |

## Architecture

```
Browser (Next.js — Vercel)
    │
    ├── Server Actions     (auth — writes HttpOnly cookies)
    ├── /auth/callback     (Google OAuth code exchange)
    │
    └── FastAPI (Railway — api.learnos.ch)
            ├── /topics /queue /flashcards /exams
            ├── /files/upload → Supabase Storage → pgvector embeddings
            ├── /quiz/generate → Anthropic API
            ├── /analytics /sessions /notes /settings /sbb
            └── Supabase PostgreSQL + Storage
```

Auth uses `@supabase/ssr` with server-validated JWTs (`getUser()`, not `getSession()`). The backend verifies every request against Supabase's JWKS endpoint — no shared secret.

Users bring their own Anthropic API key, stored encrypted with Fernet. It is never logged or returned to the frontend.

## Project Structure

```
frontend/          Next.js 14 app
├── app/
│   ├── (auth)/    login, register
│   └── (app)/     dashboard, queue, topics, flashcards, exams,
│                  files, analytics, settings
├── components/    ReviewCard, ReadinessGauge, StreakCalendar,
│                  FileUploadZone, SemanticSearchBar, ...
└── lib/           api.ts, supabase.ts, store.ts

backend/           FastAPI app
├── core/          auth.py, config.py, database.py, algorithms.py
├── routers/       one file per resource
├── services/      embeddings, llm, pdf, whisper
└── models/        schemas.py (Pydantic v2)
```

## Local Development

### Prerequisites

- Node.js 18+
- Python 3.11+
- A Supabase project with pgvector enabled

### Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in your values
uvicorn main:app --reload
# → http://localhost:8000/docs
```

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local   # fill in your values
npm run dev
# → http://localhost:3000
```

### Environment Variables

**`backend/.env`**

```bash
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_KEY=<service_role key>
DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
FERNET_SECRET=<generate: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())">
CORS_ORIGINS=http://localhost:3000
```

**`frontend/.env.local`**

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Running Tests

```bash
cd backend && pytest tests/ -v
cd frontend && npx tsc --noEmit
```

## Deployment

- **Frontend** → Vercel (`vercel --prod` from `frontend/`)
- **Backend** → Railway (`railway up` from `backend/`)
- Set all environment variables in the respective dashboards
