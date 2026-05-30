# LearnOS — Project Handover

**Date:** 2026-05-30  
**Phase completed:** Phase 1 (Foundation)  
**Next phase:** Phase 2 (Core Learning Loop)

---

## 1. Project Structure — What Exists

```
learnos/
├── CLAUDE.md                          # Claude Code project context (loaded every session)
├── HANDOVER.md                        # This file
├── .claude/settings.json              # Project permissions (npm, python, etc. pre-allowed)
├── supabase/
│   └── migrations/
│       └── 20250530000000_initial_schema.sql   # FULL schema — NOT yet applied to Supabase
├── backend/                           # FastAPI (Python 3.12)
│   ├── .env.example                   # Template — copy to .env and fill in
│   ├── .gitignore
│   ├── Procfile                       # Railway: `web: uvicorn main:app ...`
│   ├── requirements.txt
│   ├── pytest.ini
│   ├── main.py                        # App entry, CORS, lifespan, routers
│   ├── core/
│   │   ├── config.py                  # pydantic-settings (all env vars)
│   │   ├── auth.py                    # JWT verify → CurrentUser dependency
│   │   ├── database.py                # asyncpg pool (init/close/get_db)
│   │   └── algorithms.py             # _sm2, _readiness, _chunk_text, etc.
│   ├── models/
│   │   └── schemas.py                # 25 Pydantic v2 models + ApiResponse[T]
│   ├── routers/
│   │   ├── topics.py                  # FULL: CRUD + log_lecture + SM-2 review
│   │   ├── flashcards.py              # FULL: CRUD + SM-2 review + due queue
│   │   ├── exams.py                   # FULL: CRUD + readiness score
│   │   ├── sessions.py                # FULL: start/end with auto duration
│   │   ├── analytics.py              # FULL: dashboard counts, streak, modules
│   │   ├── sbb.py                     # FULL: live proxy to transport.opendata.ch
│   │   ├── queue.py                   # STUB (Phase 2)
│   │   ├── quiz.py                    # STUB (Phase 3)
│   │   └── files.py                   # STUB (Phase 3)
│   ├── services/
│   │   ├── llm.py                     # Fernet decrypt → Anthropic API call
│   │   ├── embeddings.py              # Lazy sentence-transformers load + store
│   │   ├── pdf_service.py             # pdfplumber text extraction
│   │   └── whisper_service.py         # Lazy whisper load (Phase 4)
│   ├── tests/
│   │   ├── conftest.py                # Fixtures: mock_db, test_user, client
│   │   ├── test_algorithms.py         # 37 tests: SM-2, readiness, chunking
│   │   ├── test_schemas.py            # 23 tests: all schemas + ApiResponse
│   │   └── test_api.py                # 31 tests: HTTP endpoints (mocked DB)
│   └── .venv/                         # Python 3.12 venv (not committed)
└── frontend/                          # Next.js 14 (TypeScript strict)
    ├── .env.local.example             # Template — copy to .env.local and fill in
    ├── .gitignore
    ├── package.json
    ├── tsconfig.json                  # strict: true
    ├── next.config.ts
    ├── tailwind.config.ts             # LearnOS design system tokens
    ├── postcss.config.mjs
    ├── middleware.ts                  # Session refresh + route protection
    ├── app/
    │   ├── globals.css                # Plus Jakarta Sans + Tailwind + glass helpers
    │   ├── layout.tsx                 # Root layout: Providers wrapper
    │   ├── (auth)/
    │   │   ├── layout.tsx             # Mint gradient background
    │   │   ├── login/page.tsx         # Email/pw + Google OAuth, Zod validation
    │   │   └── register/page.tsx      # + confirm pw, post-submit success state
    │   ├── (app)/
    │   │   ├── layout.tsx             # Server: auth guard + Sidebar
    │   │   └── dashboard/page.tsx     # Server: greeting + 4 stat cards (Phase 2 fills data)
    │   └── auth/callback/route.ts     # OAuth PKCE code exchange
    ├── components/
    │   ├── providers.tsx              # React Query QueryClientProvider
    │   ├── sidebar.tsx                # Fixed sidebar, 8 nav items, sign-out
    │   └── ui/
    │       ├── button.tsx             # 6 variants + loading spinner prop
    │       ├── card.tsx               # Glassmorphism card + Header/Content/Footer
    │       ├── input.tsx              # Glass input, error prop, aria-invalid
    │       └── label.tsx              # Radix label
    └── lib/
        ├── supabase.ts                # createBrowserClient (client components)
        ├── supabase-server.ts         # createServerClient (server components)
        ├── store.ts                   # Zustand: useAuthStore, useUIStore
        ├── api.ts                     # Typed API client (topicsApi, analyticsApi)
        └── utils.ts                   # cn() (clsx + tailwind-merge)
```

---

## 2. Phase 1 Completion Status

### ✅ Done

| Item | Status | Notes |
|------|--------|-------|
| PostgreSQL schema | Written, not yet applied | `supabase/migrations/20250530000000_initial_schema.sql` |
| pgvector extension | In migration | `CREATE EXTENSION IF NOT EXISTS vector` |
| RLS policies | In migration | All 13 tables, with proxy subquery for `file_chunks` + `exam_topics` |
| ivfflat index | In migration | `file_chunks.embedding`, 100 lists, cosine ops |
| `search_file_chunks()` SQL fn | In migration | Called from FastAPI `/search/semantic` |
| FastAPI skeleton | ✅ Running locally | `uvicorn main:app --reload` works with real `.env` |
| Auth middleware | ✅ | PyJWT HS256 verify, `get_current_user` dependency |
| asyncpg pool | ✅ | `init_pool` / `close_pool` via lifespan |
| `/topics` CRUD | ✅ Full | list, get, create (Ebbinghaus interval), update, delete, SM-2 review + streak upsert |
| `/flashcards` CRUD + review | ✅ Full | SM-2 identical to topics |
| `/exams` + readiness | ✅ Full | `_readiness()` wired to real query |
| `/sessions` start/end | ✅ Full | auto `duration_minutes` on end |
| `/analytics` dashboard | ✅ Partial | counts from DB; streak calendar; module stats. Full data assembly in Phase 2. |
| `/sbb` proxy | ✅ Full | live call to `transport.opendata.ch` |
| Test suite | ✅ 91/91 pass | algorithms, schemas, API (all mocked) |
| Next.js 14 scaffold | ✅ | App Router, TypeScript strict, Tailwind |
| Design system | ✅ | Glassmorphism, teal primary, orange CTA, Plus Jakarta Sans; persisted to `design-system/learnos/MASTER.md` |
| Supabase Auth | ✅ | email/password + Google OAuth on both login + register |
| `middleware.ts` | ✅ | Session refresh every request; unauthenticated → `/login`; authenticated → skip auth pages |
| OAuth callback | ✅ | `app/auth/callback/route.ts` — PKCE code exchange |
| App layout + sidebar | ✅ | Fixed sidebar, 8 nav items, active route, sign-out |
| Dashboard stub | ✅ | Server component, Supabase user read, 4 stat cards |
| TypeScript type-check | ✅ 0 errors | `npm run type-check` passes |

### ❌ Not Yet Done (Phase 1 spec items)

| Item | Why deferred | Where to pick up |
|------|-------------|-----------------|
| Apply SQL migration to Supabase | Requires Supabase project + credentials | See §6 — run in Supabase SQL Editor |
| Copy + fill `.env` files | Requires Supabase project | See §6 |
| Deploy backend to Railway | Requires Railway account + env vars | After env vars set up |
| Deploy frontend to Vercel | Requires Vercel account + env vars | After env vars set up |
| `/topics` CRUD verified end-to-end | Requires live Supabase DB | After migration applied |
| Supabase Storage bucket creation | Manual step in Supabase Dashboard | See §7 |
| Google OAuth provider setup | Manual in Supabase Auth settings | See §7 |

---

## 3. Every Decision Made

### Database

| Decision | Choice | Why |
|----------|--------|-----|
| DB client | asyncpg (not supabase-py for SQL) | Direct PostgreSQL: supports complex SQL, pgvector ops, connection pooling, faster than REST API |
| Storage client | supabase-py | Only used for Supabase Storage bucket operations (Phase 3) |
| JWT verification | PyJWT local (not Supabase admin API) | Avoids HTTP round-trip per request; HS256 with `SUPABASE_JWT_SECRET` |
| RLS proxy policies | `file_id IN (SELECT id FROM files WHERE user_id = auth.uid())` | `file_chunks` and `exam_topics` have no `user_id` column — can't use the simple policy pattern |
| ivfflat lists = 100 | 100 | Good balance for up to ~1M chunks; recalibrate if corpus grows significantly |

### Backend

| Decision | Choice | Why |
|----------|--------|-----|
| Python version | 3.12 (homebrew) | System Python is 3.9 — too old for `X \| Y` union syntax used in type hints |
| Virtual env path | `backend/.venv/` | Keeps it project-local; not committed |
| API response envelope | `{ data, error }` always | Spec requirement; custom `HTTPException` handler wraps all errors in the same shape |
| Fernet encryption | `cryptography.fernet` | Key = `FERNET_SECRET` (must be a valid Fernet key — 32 URL-safe base64 bytes). Used for encrypting users' Anthropic API keys at rest |
| `sentence-transformers` | Left in requirements but noted as heavy | Keep the import lazy (`_get_model()`) so Railway builds don't fail if you want to skip it |
| `openai-whisper` | Commented out in requirements | Pulls all of PyTorch — only uncomment in Phase 4 |
| Test mocking strategy | Patch `main.init_pool` / `main.close_pool` (not `core.database.*`) | By the time the test client runs, `main.py` has already imported those names by reference — must patch at the call site |

### Frontend

| Decision | Choice | Why |
|----------|--------|-----|
| `@supabase/ssr` version | `^0.3.0` | Next.js 14 uses synchronous `cookies()`. Version 0.4+ targets Next.js 15 async cookies |
| Font | Plus Jakarta Sans | ui-ux-pro-max recommendation for "SaaS productivity, professional, friendly" |
| Style | Glassmorphism | Second ui-ux-pro-max query (first returned "Claymorphism / Comic Neue" which was too childish for university students) |
| Colors | Teal-600 primary (#0D9488), orange CTA (#F97316) | ui-ux-pro-max "university SaaS" palette |
| shadcn/ui approach | Manual component files (not shadcn CLI) | Avoids interactive CLI requirement; components are small enough to write directly; can add CLI-generated ones later |
| `CookieOptions` typing | Imported from `@supabase/ssr` | TypeScript strict-mode complained about implicit `any` in the cookie callbacks — explicit type silences it |
| Sidebar | Fixed at `w-64`, glassmorphism, server-side user read | Keeps page content aligned; user email fetched once in `(app)/layout.tsx` server component |

### Bug found and fixed

| Bug | Fix |
|-----|-----|
| `_chunk_text()` infinite loop when `overlap >= chunk_size` | Added `step = max(1, chunk_size - overlap)` guard in `core/algorithms.py:75` |

---

## 4. Known Issues & TODOs

### Must fix before first real user

- **Migration not applied** — the entire database schema exists only as a file. Nothing in the backend will work until it's run in Supabase.
- **No `.env` files** — `backend/.env` and `frontend/.env.local` do not exist. Both contain `*.example` templates.
- **`analytics/dashboard` is partial** — returns live `due_today` / `due_flashcards` / `total_topics` counts but `current_streak`, `study_time_*`, `next_exam`, `readiness_score` are all hardcoded 0/None. Full assembly is Phase 2 work.
- **`queue.py` returns empty** — `GET /queue` always returns `{ items: [], total_due: 0 }`. Phase 2 work.
- **Dashboard stat cards show "—"** — frontend reads from the API (Phase 2) not yet wired. Currently displays placeholder values.

### Technical debt / deferred items

- `routers/files.py` — upload endpoint returns `ApiResponse.fail("File upload available in Phase 3")`. File upload, indexing, and semantic search are fully Phase 3.
- `routers/quiz.py` — `generate_quiz` returns `[]`. Phase 3 (requires Anthropic key flow).
- `services/whisper_service.py` — imports `whisper` lazily but `openai-whisper` is commented out in `requirements.txt`. Enable in Phase 4.
- `services/embeddings.py` — `sentence-transformers` is in `requirements.txt` but will fail on first import if not installed. Uncomment or install before Phase 3.
- Dashboard dashboard page uses `user.email.split('@')[0]` as first name — could add a `full_name` field to `user_settings` table in a future migration.
- `@radix-ui/react-toast` is in `package.json` but no `Toast` component exists yet. Add when needed.
- `@radix-ui/react-separator` is in `package.json` but no `Separator` component exists yet (used inline in auth pages via a plain `<div>`).
- Test warning: `StarletteDeprecationWarning: Using httpx with starlette.testclient is deprecated; install httpx2 instead` — non-breaking, will resolve when `httpx2` is released.

---

## 5. Exact Next Steps

### Immediate (to make Phase 1 fully operational)

```
1. Create a Supabase project at https://supabase.com
2. Copy backend/.env.example → backend/.env  (fill all 5 variables — see §6)
3. Copy frontend/.env.local.example → frontend/.env.local  (fill 3 variables)
4. Run the SQL migration (see §7 step 1)
5. Create the Supabase Storage bucket (see §7 step 2)
6. Enable Google OAuth in Supabase Auth settings (see §7 step 3)
7. Start backend:  cd backend && uvicorn main:app --reload
8. Start frontend: cd frontend && npm run dev
9. Visit http://localhost:3000/register, create an account, confirm email, sign in
10. Hit http://localhost:8000/health → should return {"data":{"status":"ok",...},"error":null}
11. POST a topic to http://localhost:8000/topics with a Bearer token → verify SM-2 works
```

### Phase 2 — Core Learning Loop

Build in this order:

1. **`GET /queue`** in `routers/queue.py`
   - Query: `SELECT * FROM topics WHERE user_id=$1 AND next_review_due <= CURRENT_DATE ORDER BY next_review_due LIMIT 20`
   - Apply cognitive load cap (from `cognitive_load` table, max 300 pts/day at 60 pts/topic)
   - Return `QueueItemResponse` with `overdue_days` and `priority` score

2. **`GET /analytics/dashboard`** — fully assemble all fields
   - `current_streak`: count consecutive days in `learning_streak` backwards from today
   - `study_time_today_minutes`: sum `duration_minutes` from `study_sessions` for today
   - `study_time_7d_avg_minutes`: avg of last 7 days
   - `next_exam` + `readiness_score`: closest future exam + call `_readiness()`

3. **`ReviewCard.tsx`** — Phase 2's centerpiece component
   - File: `frontend/components/ReviewCard.tsx`
   - Flow: show topic name → click "Show answer" → show quality buttons 0–5 → call `POST /topics/:id/review` → optimistic update → next card
   - Quality buttons: `[0 Blackout] [1 Wrong] [2 Hard] [3 OK] [4 Good] [5 Perfect]` with red/orange/yellow/green colors

4. **`/queue` page** — wires `ReviewCard.tsx` to `GET /queue`
   - File: `frontend/app/(app)/queue/page.tsx`

5. **`StreakCalendar.tsx`** — GitHub-style heatmap
   - File: `frontend/components/StreakCalendar.tsx`
   - Data: `GET /analytics/streak` (returns last 365 days)

6. **Complete dashboard** — wire all 4 stat cards to live `GET /analytics/dashboard` data
   - Use React Query: `useQuery({ queryKey: ['dashboard'], queryFn: analyticsApi.dashboard })`

---

## 6. Environment Variables

### Backend — `backend/.env`

| Variable | Where to get it | Example |
|----------|----------------|---------|
| `SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL | `https://abcdefgh.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase Dashboard → Settings → API → service_role key (secret) | `eyJhbGc...` |
| `SUPABASE_JWT_SECRET` | Supabase Dashboard → Settings → API → JWT Settings → JWT Secret | 40+ char string |
| `DATABASE_URL` | Supabase Dashboard → Settings → Database → Connection string (URI) — use the **pooler** URL for production | `postgresql://postgres.[ref]:[password]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres` |
| `FERNET_SECRET` | Generate once: `python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` | `nDxodTA70n...` |
| `CORS_ORIGINS` | Comma-separated allowed origins | `http://localhost:3000,https://learnos.vercel.app` |

> ⚠️ `SUPABASE_SERVICE_KEY` bypasses RLS. Never expose it outside the backend.

### Frontend — `frontend/.env.local`

| Variable | Where to get it |
|----------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Same as `SUPABASE_URL` above |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → anon/public key |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` locally; Railway URL in production |

---

## 7. Commands to Verify Everything Works

### Step 1 — Apply the SQL migration

Go to **Supabase Dashboard → SQL Editor → New query**, paste the contents of:
```
supabase/migrations/20250530000000_initial_schema.sql
```
Run it. Verify in **Table Editor** that all 13 tables appear.

### Step 2 — Create Supabase Storage bucket

In **Supabase Dashboard → Storage → New bucket**:
- Name: `learnos-files`
- Public: **off**
- Allowed MIME types: `application/pdf, audio/*, text/plain`

Then add RLS policies for the bucket (in SQL Editor):
```sql
-- Allow authenticated users to upload to their own folder
CREATE POLICY "users_upload_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'learnos-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow authenticated users to read their own files
CREATE POLICY "users_read_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'learnos-files' AND auth.uid()::text = (storage.foldername(name))[1]);
```

### Step 3 — Enable Google OAuth

In **Supabase Dashboard → Authentication → Providers → Google**:
- Enable Google provider
- Add Client ID + Secret from [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
- Add `https://[your-project].supabase.co/auth/v1/callback` as an authorized redirect URI in Google Cloud

### Step 4 — Run backend

```bash
cd /Users/nilswyser/learnos/backend
# (venv already exists at .venv/)
.venv/bin/uvicorn main:app --reload --port 8000
```

Expected output:
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Application startup complete.
```

Verify:
```bash
curl http://localhost:8000/health
# → {"data":{"status":"ok","version":"0.1.0"},"error":null}
```

### Step 5 — Run backend tests

```bash
cd /Users/nilswyser/learnos/backend
.venv/bin/pytest tests/ -v
# → 91 passed, 1 warning in ~0.1s
```

### Step 6 — Run frontend

```bash
cd /Users/nilswyser/learnos/frontend
npm run dev
# → http://localhost:3000
```

Visit:
- `http://localhost:3000/login` — should show glassmorphism auth card
- `http://localhost:3000/register` — should show register form
- `http://localhost:3000/dashboard` — middleware redirects to `/login` if not authenticated; shows dashboard if authenticated

### Step 7 — TypeScript type-check

```bash
cd /Users/nilswyser/learnos/frontend
npm run type-check
# → (no output = 0 errors)
```

### Step 8 — End-to-end smoke test (after Supabase is set up)

```bash
# 1. Register a user via the UI at http://localhost:3000/register
# 2. Confirm the email
# 3. Sign in — should land on /dashboard

# 4. Get a JWT token (from browser DevTools → Application → Supabase session → access_token)
TOKEN="<paste_access_token>"

# 5. Log a lecture
curl -X POST http://localhost:8000/topics \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Linear Algebra","module":"Mathematics","understanding_score":4}'
# → {"data":{"id":"...","name":"Linear Algebra","next_review_due":"2026-06-02",...},"error":null}

# 6. Review a topic (replace TOPIC_ID with the id from step 5)
curl -X POST http://localhost:8000/topics/TOPIC_ID/review \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"quality":4}'
# → {"data":{"topic":{...},"next_review_due":"2026-06-08","interval_days":6},"error":null}
```

---

## 8. Design System Reference

Persisted at: `design-system/learnos/MASTER.md`

| Token | Value |
|-------|-------|
| Style | Glassmorphism |
| Primary | `#0D9488` (teal-600) |
| Secondary | `#14B8A6` (teal-500) |
| CTA | `#F97316` (orange-500) |
| Background | `#F0FDFA` (teal-50) |
| Text | `#134E4A` (teal-900) |
| Font | Plus Jakarta Sans (300–800) |
| Card | `bg-white/80 backdrop-blur-md border-white/50 shadow-glass` |
| Border radius | `rounded-2xl` (1rem) on cards, `rounded-xl` on inputs/buttons |
| Animation | `150-300ms ease-out` |

**Rule:** Before any new frontend page/component, always run:
```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<page-description>" --design-system --persist -p "LearnOS" --page "<page-name>"
```
This generates a page-specific override in `design-system/learnos/pages/<page-name>.md`.
