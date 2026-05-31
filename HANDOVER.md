# LearnOS — Project Handover
**Last updated:** 2026-05-31
**Current commit:** `37d3482` (main branch)
**Status:** All phases (1–4) complete. Deployed to Railway + Vercel. learnos.ch DNS live.

---

## Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [Deployment URLs](#2-deployment-urls)
3. [File Inventory](#3-file-inventory)
4. [Phase Completion Status](#4-phase-completion-status)
5. [Environment Variables](#5-environment-variables)
6. [Every Technical Decision Made](#6-every-technical-decision-made)
7. [Known Issues & TODOs](#7-known-issues--todos)
8. [Next Steps (Phase 4)](#8-next-steps-phase-4)
9. [Verification Commands](#9-verification-commands)

---

## 1. Architecture Overview

```
Browser (Next.js 14 App Router — Vercel)
    │
    ├── /api/auth/callback  (Route Handler — Google OAuth)
    ├── Server Actions      (login — writes cookies server-side)
    │
    └── FastAPI Backend (Railway — learnos-api-production.up.railway.app)
            ├── /topics          ← CRUD + SM-2 review
            ├── /queue           ← daily learning queue (SM-2 + cognitive load)
            ├── /flashcards      ← SM-2 flashcard CRUD + review
            ├── /exams           ← CRUD + readiness scoring
            ├── /files           ← upload → Storage → pgvector embeddings
            ├── /quiz            ← Claude AI question generation + scoring
            ├── /settings        ← Anthropic API key (Fernet encrypted)
            ├── /analytics       ← dashboard, streak, modules, quiz history, due breakdown
            ├── /sessions        ← study session start/end (wired frontend + backend)
            └── /sbb             ← Swiss transport API proxy (stub)
                    └── Supabase PostgreSQL (pgvector, 13 tables)
                    └── Supabase Storage   (learnos-files bucket)
```

**Auth flow:**
1. Login form → `loginAction()` Server Action
2. `@supabase/ssr` `createServerClient` calls `signInWithPassword`
3. Session cookies + `redirect('/dashboard')` bundled in same RSC response
4. Middleware uses `getUser()` (server-validated JWT, not just cookie read)

---

## 2. Deployment URLs

| Service | URL |
|---------|-----|
| Frontend (production) | `https://learnos.ch` / `https://www.learnos.ch` |
| Frontend (Vercel internal) | `https://frontend-dojbxekys-wysernils04s-projects.vercel.app` |
| Backend (Railway) | `https://learnos-api-production.up.railway.app` |
| Backend (custom domain) | `https://api.learnos.ch` *(DNS must be set — see §5)* |
| Supabase Dashboard | `https://supabase.com/dashboard/project/hrxkpukmcndhwllbkbsx` |
| Railway Dashboard | `https://railway.com/project/c83ebfcf-1928-4820-968b-34110dd1c95b` |
| Vercel Dashboard | `https://vercel.com/wysernils04s-projects/frontend` |

**DNS records required at registrar (learnos.ch):**

| Type | Name | Value |
|------|------|-------|
| `A` | `@` | `76.76.21.21` |
| `A` | `www` | `76.76.21.21` |
| `CNAME` | `api` | `learnos-api-production.up.railway.app` |

---

## 3. File Inventory

### Backend (`backend/`)

#### Core

| File | Description |
|------|-------------|
| `main.py` | FastAPI app — lifespan (pool init, Storage bucket check), CORS, error envelope, all routers |
| `core/config.py` | pydantic-settings — reads `.env`, `cors_origins_list` property |
| `core/database.py` | asyncpg pool — `_parse_db_url()` handles `@` in passwords, `statement_cache_size=0` for Supavisor |
| `core/auth.py` | PyJWT local decode (HS256, aud=`authenticated`). Returns `CurrentUser(id, email)` |
| `core/algorithms.py` | **Do not modify.** `_sm2()`, `score_to_quality()`, `first_review_days()`, `_readiness()`, `_chunk_text()` |
| `core/storage.py` | Supabase Storage singleton — `get_storage()`, `ensure_bucket()` (called at startup) |

#### Routers

| File | Status | Key Endpoints |
|------|--------|---------------|
| `routers/topics.py` | ✅ Full | `GET/POST/PUT/DELETE /topics`, `GET /topics/{id}`, `GET /topics/{id}/files`, `POST /topics/{id}/review` |
| `routers/queue.py` | ✅ Full | `GET /queue` (SM-2 + cognitive load cap 300pts/day) |
| `routers/flashcards.py` | ✅ Full | `GET /flashcards`, `GET /flashcards/due`, `POST`, `PUT /{id}`, `DELETE /{id}`, `POST /{id}/review` |
| `routers/exams.py` | ✅ Full | `GET/POST/DELETE /exams`, `GET /exams/{id}/topics`, `GET /exams/{id}/readiness` |
| `routers/files.py` | ✅ Full | `GET /files`, `POST /files/upload`, `DELETE /files/{id}`, `POST /files/search` |
| `routers/quiz.py` | ✅ Full | `POST /quiz/generate`, `GET /quiz/{topic_id}`, `POST /quiz/result` |
| `routers/settings.py` | ✅ Full | `GET /settings`, `PUT /settings/api-key`, `DELETE /settings/api-key` |
| `routers/analytics.py` | ✅ Full | `GET /analytics/dashboard`, `/streak`, `/modules`, `/quiz-history`, `/topics-due` |
| `routers/sessions.py` | ✅ Full | `POST /sessions/start`, `POST /sessions/{id}/end` — **no frontend yet** |
| `routers/sbb.py` | ⚠️ Stub | `GET /sbb/connections` — proxies transport.opendata.ch — **no frontend** |

#### Services

| File | Status | Notes |
|------|--------|-------|
| `services/pdf_service.py` | ✅ Full | pdfplumber — `extract_text()`, `extract_text_by_page()` |
| `services/embeddings.py` | ✅ Full | sentence-transformers `paraphrase-multilingual-MiniLM-L12-v2` — `encode()`, `encode_batch()` |
| `services/llm.py` | ✅ Full | AsyncAnthropic `claude-haiku-4-5-20251001` — `generate_quiz_questions()`, `encrypt_key()` |
| `services/whisper_service.py` | ✅ Full | OpenAI Whisper tiny — transcribes audio to text; wired in upload pipeline with OOM fallback |

#### Models
- `models/schemas.py` — all Pydantic v2 schemas for every endpoint (complete)

#### Tests (`tests/`)
- `test_algorithms.py` — SM-2, readiness, chunking
- `test_schemas.py` — schema validation
- `test_api.py` — dashboard with mocked DB

---

### Frontend (`frontend/`)

#### App Routes

| File | Type | Description |
|------|------|-------------|
| `app/layout.tsx` | Server | Root layout — fonts, providers, globals |
| `app/(auth)/layout.tsx` | Server | Centered auth wrapper |
| `app/(auth)/login/page.tsx` | Client | Login form — react-hook-form + zod |
| `app/(auth)/login/actions.ts` | Server Action | `loginAction` — signs in, redirects `/dashboard` |
| `app/(auth)/register/page.tsx` | Client | Register — client-side `signUp`, email confirm prompt |
| `app/auth/callback/route.ts` | Route Handler | Google OAuth code exchange |
| `app/(app)/layout.tsx` | Server | App shell — `getUser()` guard, `<Sidebar>` |
| `app/(app)/dashboard/page.tsx` | Server | Greeting + `<DashboardStats>` |
| `app/(app)/dashboard/stats.tsx` | Client | React Query `/analytics/dashboard` + `/analytics/streak` |
| `app/(app)/queue/page.tsx` | Client | SM-2 review queue — `<ReviewCard>`, progress bar |
| `app/(app)/topics/page.tsx` | Client | Topics CRUD — list, create/edit dialog, delete, search/filter |
| `app/(app)/topics/[id]/page.tsx` | Client | Topic detail — SM-2 stats, linked files, semantic search, AI quiz |
| `app/(app)/files/page.tsx` | Client | File upload zone, semantic search, file list with delete |
| `app/(app)/flashcards/page.tsx` | Client | Review tab (due queue) + Manage tab (CRUD) |
| `app/(app)/exams/page.tsx` | Client | Exam list with readiness panel, create dialog with topic multi-select |
| `app/(app)/analytics/page.tsx` | Client | 4 Recharts charts — activity, module understanding, schedule donut, quiz trend |
| `app/(app)/settings/page.tsx` | Client | Anthropic API key save/delete with show/hide toggle |

#### Components

| File | Description |
|------|-------------|
| `components/sidebar.tsx` | Fixed left sidebar — all 8 nav links, sign-out |
| `components/providers.tsx` | `QueryClientProvider` wrapper |
| `components/ReviewCard.tsx` | SM-2 topic flip card — quality 0–5 buttons |
| `components/FlashcardReviewCard.tsx` | Flashcard flip card — question → reveal answer → quality 0–5 |
| `components/QuizRunner.tsx` | AI quiz runner — MC, true/false, short answer, score submission |
| `components/ReadinessGauge.tsx` | SVG semicircular gauge 0–100% — teal/orange/red zones |
| `components/FileUploadZone.tsx` | Drag-and-drop upload — 50MB limit, PDF/TXT/audio |
| `components/StreakCalendar.tsx` | 53-week GitHub-style heatmap — teal intensity |
| `components/ui/button.tsx` | shadcn Button + `loading` prop |
| `components/ui/card.tsx` | shadcn Card |
| `components/ui/dialog.tsx` | shadcn Dialog |
| `components/ui/input.tsx` | shadcn Input + `error` prop |
| `components/ui/label.tsx` | shadcn Label |

#### Lib

| File | Description |
|------|-------------|
| `lib/api.ts` | Typed fetch wrapper — Bearer auth, all endpoint functions and types |
| `lib/supabase.ts` | Browser client — `createBrowserClient` |
| `lib/supabase-server.ts` | Server client — `createServerClient` with `get`/`set`/`remove` cookie API |
| `lib/store.ts` | Zustand stores (placeholder — not yet used) |
| `lib/utils.ts` | `cn()` helper |

#### Config

| File | Description |
|------|-------------|
| `middleware.ts` | `getUser()` route protection, unauthenticated → `/login` |
| `next.config.mjs` | Supabase Storage image domains. **Must be `.mjs`** — `.ts` is invalid |
| `tailwind.config.ts` | Teal palette (`primary-*`), orange CTA, glassmorphism utilities |
| `components.json` | shadcn/ui config |

---

### Database (`supabase/`)

`supabase/migrations/20250530000000_initial_schema.sql` — **applied to Supabase**

**13 tables (all with RLS `auth.uid() = user_id`):**

| Table | Purpose |
|-------|---------|
| `user_settings` | Anthropic API key (Fernet-encrypted), per user |
| `topics` | Core learning topics — full SM-2 state |
| `cognitive_load` | Daily load cap (60pts/topic, 300pts/day max) |
| `quiz_history` | Quiz attempt scores — feeds readiness algorithm |
| `notes` | Free-text topic notes (no frontend yet) |
| `learning_streak` | Daily review counts — feeds heatmap + streak counter |
| `files` | File metadata — path, type, chunk count, sha256 |
| `file_chunks` | pgvector 384-dim embeddings — `search_file_chunks()` SQL function |
| `exams` | Upcoming exams with dates |
| `exam_topics` | Many-to-many: exams ↔ topics |
| `flashcards` | SM-2 flashcards with question/answer |
| `study_sessions` | Session start/end/duration — wired in queue + flashcard pages |
| `generated_quizzes` | Claude-generated questions persisted per topic |

**Also:** `update_updated_at()` trigger, `search_file_chunks()` pgvector cosine similarity function, 20+ indexes.

**Supabase Storage:** bucket `learnos-files` (private) — created automatically at backend startup via `ensure_bucket()`.

---

## 4. Phase Completion Status

### Phase 1 — Foundation ✅ COMPLETE

| Item | Status | Notes |
|------|--------|-------|
| Supabase Auth (email) | ✅ | Working end-to-end |
| Supabase Auth (Google OAuth) | ⚠️ | Code wired, needs Google Cloud credentials in Supabase Dashboard → Auth → Providers → Google |
| DB schema + RLS + pgvector | ✅ | Migration applied |
| FastAPI skeleton + all routers | ✅ | |
| Next.js + auth | ✅ | Login verified with real credentials |
| `/topics` CRUD | ✅ | |
| Deploy Railway + Vercel | ✅ | Live at learnos.ch (pending DNS propagation) |

### Phase 2 — Core Loop ✅ COMPLETE

| Item | Status |
|------|--------|
| `GET /queue` (SM-2 + cognitive load) | ✅ |
| `<ReviewCard>` flip + quality 0–5 | ✅ |
| `/queue` page | ✅ |
| Dashboard stats (live data) | ✅ |
| `<StreakCalendar>` heatmap | ✅ |

### Phase 3 — Features ✅ COMPLETE

| Item | Status |
|------|--------|
| File upload → Storage → pdfplumber → sentence-transformers → pgvector | ✅ |
| `POST /files/search` semantic search (cosine similarity) | ✅ |
| `/files` page with drag-and-drop + search | ✅ |
| `/topics/[id]` detail with scoped semantic search | ✅ |
| Flashcards SM-2 (review queue + CRUD) | ✅ |
| Exams + `ReadinessGauge` SVG | ✅ |
| `/settings` — Anthropic API key encrypted storage | ✅ |
| `POST /quiz/generate` — Claude Haiku MCQ generation | ✅ |
| `<QuizRunner>` — MC, T/F, short answer + score | ✅ |
| Analytics charts (Recharts) — activity, modules, schedule, quiz trend | ✅ |

### Phase 4 — Polish ✅ COMPLETE

| Item | Status |
|------|--------|
| Audio transcription (Whisper tiny) — wired in upload pipeline, graceful fallback on OOM | ✅ |
| SBB connections widget on dashboard — localStorage station config, `/sbb/connections` | ✅ |
| PWA manifest + apple-web-app meta + 192/512 icons | ✅ |
| Study sessions frontend — start/end on `/queue` and `/flashcards` review | ✅ |
| Notes per topic — CRUD, inline edit, `TopicNotes` on `/topics/[id]` | ✅ |
| Analytics export — `GET /analytics/export` CSV + Export button on `/analytics` | ✅ |
| Study time analytics chart — `GET /analytics/sessions` + bar chart on `/analytics` | ✅ |

---

## 5. Environment Variables

### Backend (`backend/.env`) — never commit

```bash
# Supabase project URL — base URL only, NO trailing path
SUPABASE_URL=https://hrxkpukmcndhwllbkbsx.supabase.co
# Get from: Supabase Dashboard → Settings → API → Project URL

# Service role key — bypasses RLS. Backend only, never expose to frontend.
# Get from: Supabase Dashboard → Settings → API → service_role key
SUPABASE_SERVICE_KEY=eyJhbGc...

# JWT secret for local token verification (avoids network call per request)
# Get from: Supabase Dashboard → Settings → API → JWT Settings → JWT Secret
SUPABASE_JWT_SECRET=<40+ char string>

# Connection pooler — session mode port 5432 (NOT transaction mode 6543)
# Get from: Supabase Dashboard → Settings → Database → Connection string → Session mode
# URL-encode special chars in password: @ → %40, # → %23
DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres

# Fernet encryption key for users' Anthropic API keys
# Generate: python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
FERNET_SECRET=<base64 fernet key>

# Comma-separated CORS origins
CORS_ORIGINS=http://localhost:3000,https://learnos.ch,https://www.learnos.ch,https://frontend-dojbxekys-wysernils04s-projects.vercel.app
```

### Frontend (`frontend/.env.local`) — never commit

```bash
# Supabase project URL — no trailing slash
NEXT_PUBLIC_SUPABASE_URL=https://hrxkpukmcndhwllbkbsx.supabase.co

# Supabase anon key (safe to expose — protected by RLS)
# Get from: Supabase Dashboard → Settings → API → anon key
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...

# Backend URL
NEXT_PUBLIC_API_URL=http://localhost:8000            # local dev
# NEXT_PUBLIC_API_URL=https://api.learnos.ch         # production
```

### Railway environment (already set via `railway variables`)

All backend env vars listed above are set in Railway production environment.
To verify: `railway variables --service learnos-api`

### Vercel environment (already set via `vercel env`)

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL` are set for production.
To verify: `vercel env ls`

---

## 6. Every Technical Decision Made

### Auth: Server Action + `redirect()` (not client-side `router.push`)

`@supabase/ssr` sets session cookies server-side. Client-side `router.push` causes Next.js to navigate before cookies are committed → middleware never sees the session. Fix: `loginAction` Server Action calls `signInWithPassword` then `redirect('/dashboard')` — cookies and redirect travel in the same RSC response.

### `@supabase/ssr` 0.3.0 — old cookie API

Version 0.3.0 uses `{ get, set, remove }` callbacks. Version ≥0.5 uses `{ getAll, setAll }`. Using the wrong API causes `cookies.set` to be `undefined` → sessions silently never written. The `try/catch` in `set`/`remove` is intentional: `cookieStore.set()` throws in Server Component context (read-only) but works in Server Actions and Route Handlers.

### Middleware: `getUser()` not `getSession()`

`getUser()` validates the JWT server-side and refreshes expired tokens. `getSession()` only reads the local cookie without validation — unreliable for route protection.

### asyncpg: custom URL parser + `statement_cache_size=0`

`urlparse` breaks on passwords containing `@` (Supabase passwords often include `@` characters, producing multiple `@` in the URL). Fix: `_parse_db_url()` in `core/database.py` uses `rfind('@')` for host separator, `index(':')` for user/password split, `unquote()` for percent-encoded values.

Supabase Supavisor transaction mode (port 6543) doesn't support prepared statements → `statement_cache_size=0`. Always use session mode (port 5432).

### JWT: local PyJWT decode, not Supabase Admin API

Avoids one outbound HTTP call per request. `SUPABASE_JWT_SECRET` is the HS256 signing key. Validated: `exp`, `aud = "authenticated"`, `sub` (user ID).

### `next.config.mjs` not `.ts`

Next.js config must be `.js`, `.mjs`, or `.cjs`. TypeScript syntax is invalid. Use `/** @type {import('next').NextConfig} */` JSDoc for IDE hints.

### Cognitive load cap: 300 pts/day, 60 pts/topic

Queue never returns more than `(300 - load_today) / 60` items. Protects students on exam weeks from being overwhelmed.

### Topics first review: Ebbinghaus interval

`next_review_due = today + round(understanding_score * 2.0 * log(1/0.7))`. Score 1 → 1 day, score 3 → 2 days, score 5 → 4 days.

### File uploads: SHA256 deduplication

Before uploading to Supabase Storage, SHA256 of the file content is checked against `files.sha256` per user. Duplicate returns the existing record. Storage path: `{user_id}/{sha_prefix}/{filename}`.

### Embeddings: run in thread pool executor

`sentence-transformers` is synchronous and CPU-bound. Running `encode_batch()` directly in an async FastAPI handler would block the event loop. Wrapped with `loop.run_in_executor(None, partial(emb_svc.encode_batch, texts))`.

### Semantic search topic_id filter: post-fetch Python filter

The `search_file_chunks()` SQL function doesn't accept a `topic_id` filter. Rather than a new migration, the `/files/search` endpoint fetches up to `limit * 4` results and filters by `topic_id` in Python. Acceptable for MVP — small data volumes.

### Quiz LLM: Claude Haiku, not Sonnet

`claude-haiku-4-5-20251001` is ~10× cheaper than Sonnet for MCQ generation with similar quality. Users pay from their own API key so cost matters.

### API keys: Fernet encrypted at rest

Users' Anthropic API keys are encrypted with `cryptography.Fernet` before storage in `user_settings`. Key = `FERNET_SECRET` env var. Never logged or returned to frontend.

### Railway deployment: config file format

Railway CLI v4 stores project links in `~/.railway/config.json` with keys: `projectPath`, `name`, `project`, `environment`, `environmentName`, `service`. The older format (used by v3) had `projectId`/`environmentId` keys — CLI v4 rejects this with "Unable to parse config file".

### Vercel project name

The Vercel project is named `frontend` (was linked from a previous session before this one). To rename: Vercel Dashboard → Project Settings → General → Name.

---

## 7. Known Issues & TODOs

### Bugs / Limitations

| Issue | File | Severity | Status |
|-------|------|----------|--------|
| Google OAuth needs Supabase config | `app/auth/callback/route.ts` | Medium | Frontend wired, needs Google Cloud Console + Supabase credentials (see §8) |
| Whisper OOM on Railway free tier (512 MB) | `routers/files.py` | Medium | Graceful fallback added — file saves, chunks = 0. Upgrade to Hobby plan (~$5/mo) for full transcription |
| Railway auth token expires | `~/.railway/config.json` | Local-dev only | Run `railway login` again when expired |
| Sentence-transformers cold start ~5s | `services/embeddings.py` | Low | Model loads on first request. Railway keeps instance warm after first hit. |

### All features built

Everything from Phases 1–4 is complete. No 404s, no stub pages.

---

## 8. Google OAuth Setup (one-time)

### Step 1 — Google Cloud Console

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → **APIs & Services → Credentials**
2. **Create credentials → OAuth 2.0 Client ID** → Application type: **Web application**
3. Add **Authorised redirect URIs**:
   - `https://hrxkpukmcndhwllbkbsx.supabase.co/auth/v1/callback`
4. Copy the **Client ID** and **Client Secret**

### Step 2 — Supabase Dashboard

1. Go to **Authentication → Providers → Google**
2. Toggle **Enable**
3. Paste the Client ID and Client Secret
4. Save

The "Continue with Google" button on `/login` and `/register` will work immediately — no code changes needed.

---

## 9. Verification Commands

### Local development

```bash
# 1. Backend: confirm DB tables
cd backend && source .venv/bin/activate
python3 -c "
import asyncio, asyncpg
from urllib.parse import unquote
from dotenv import load_dotenv; load_dotenv('.env')
import os

def parse(dsn):
    rest = dsn.split('://', 1)[1]
    at = rest.rfind('@'); ui, hi = rest[:at], rest[at+1:]
    c = ui.index(':'); h, _, path = hi.partition('/')
    host, _, port = h.rpartition(':')
    return dict(host=host or h, port=int(port) if port.isdigit() else 5432,
                user=unquote(ui[:c]), password=unquote(ui[c+1:]), database=path or 'postgres')

async def main():
    conn = await asyncpg.connect(**parse(os.environ['DATABASE_URL']), ssl='require', statement_cache_size=0)
    rows = await conn.fetch(\"SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename\")
    print([r['tablename'] for r in rows])
    await conn.close()
asyncio.run(main())
"
# Expected: 13 tables

# 2. Backend starts
uvicorn main:app --reload
# http://localhost:8000/health → {"data":{"status":"ok","version":"0.1.0"},"error":null}
# http://localhost:8000/docs  → Swagger UI

# 3. Backend tests
pytest tests/ -v

# 4. Frontend TypeScript
cd frontend && npx tsc --noEmit
# Expected: TypeScript: No errors found

# 5. Frontend starts
npm run dev
# http://localhost:3000 → redirects to /login
```

### Production health checks

```bash
# Backend
curl https://learnos-api-production.up.railway.app/health
# → {"data":{"status":"ok","version":"0.1.0"},"error":null}

# Railway deploy status
railway status --service learnos-api

# Vercel deploy status
vercel ls

# Railway env vars
railway variables --service learnos-api

# Vercel env vars
vercel env ls
```

### Re-deploying

```bash
# Backend
cd backend && railway up --service learnos-api

# Frontend
cd frontend && vercel --prod
```

### Re-linking Railway (if config lost)

```bash
railway login
railway link --project c83ebfcf-1928-4820-968b-34110dd1c95b \
             --environment e286229e-9753-4168-b5e4-747bae72ae0e
```

---

## Key Local URLs

| URL | Purpose |
|-----|---------|
| `http://localhost:3000` | Frontend |
| `http://localhost:8000/docs` | Backend Swagger UI |
| `http://localhost:8000/health` | Health check |
| `https://supabase.com/dashboard/project/hrxkpukmcndhwllbkbsx` | Supabase Dashboard |
| `https://railway.com/project/c83ebfcf-1928-4820-968b-34110dd1c95b` | Railway Dashboard |
| `https://vercel.com/wysernils04s-projects/frontend` | Vercel Dashboard |
