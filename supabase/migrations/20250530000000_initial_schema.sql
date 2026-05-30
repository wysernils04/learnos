-- ============================================================
-- LearnOS – Initial Schema
-- Migration: 20250530000000_initial_schema.sql
--
-- Applies to: Supabase PostgreSQL (pgvector enabled)
-- Run via: Supabase SQL Editor or `supabase db push`
-- ============================================================


-- ============================================================
-- 0. EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;


-- ============================================================
-- 1. HELPER: updated_at auto-trigger
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 2. TABLES
-- ============================================================

-- User settings: Anthropic API key (Fernet-encrypted), preferences
CREATE TABLE user_settings (
    user_id                     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    anthropic_api_key_encrypted TEXT,
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Core learning topics (SM-2 state lives here)
CREATE TABLE topics (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name                    TEXT        NOT NULL,
    module                  TEXT        NOT NULL,
    understanding_score     SMALLINT    NOT NULL DEFAULT 3
                                        CHECK (understanding_score BETWEEN 1 AND 5),
    memory_strength         FLOAT       NOT NULL DEFAULT 1.0,
    easiness_factor         FLOAT       NOT NULL DEFAULT 2.5,
    sm2_interval            INTEGER     NOT NULL DEFAULT 1,
    sm2_repetitions         INTEGER     NOT NULL DEFAULT 0,
    last_reviewed           TIMESTAMPTZ,
    next_review_due         DATE        NOT NULL DEFAULT CURRENT_DATE,
    prerequisite_topic_id   UUID        REFERENCES topics(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Daily cognitive load (60 pts per calendar event, cap 300/day)
CREATE TABLE cognitive_load (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date        DATE        NOT NULL DEFAULT CURRENT_DATE,
    load_points INTEGER     NOT NULL DEFAULT 0 CHECK (load_points >= 0),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, date)
);

-- Quiz attempt history (used for SM-2 quality mapping & readiness score)
CREATE TABLE quiz_history (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    topic_id      UUID        NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    score_percent SMALLINT    NOT NULL CHECK (score_percent BETWEEN 0 AND 100),
    date          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Free-text notes attached to topics
CREATE TABLE notes (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    topic_id   UUID        NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    note_text  TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Daily streak calendar (GitHub-style heatmap source)
CREATE TABLE learning_streak (
    id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date            DATE    NOT NULL DEFAULT CURRENT_DATE,
    topics_reviewed INTEGER NOT NULL DEFAULT 0 CHECK (topics_reviewed >= 0),
    UNIQUE (user_id, date)
);

-- Uploaded files: PDFs, audio, plaintext
CREATE TABLE files (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    topic_id    UUID        REFERENCES topics(id) ON DELETE SET NULL,
    filename    TEXT        NOT NULL,
    file_path   TEXT        NOT NULL,  -- Supabase Storage object path
    file_type   TEXT        NOT NULL CHECK (file_type IN ('pdf', 'audio', 'txt')),
    page_count  INTEGER,
    chunk_count INTEGER     NOT NULL DEFAULT 0,
    sha256      TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vectorised text chunks (sentence-transformers, 384-dim)
CREATE TABLE file_chunks (
    id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id      UUID    NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    chunk_index  INTEGER NOT NULL,
    page_number  INTEGER,
    chunk_text   TEXT    NOT NULL,
    embedding    vector(384),
    UNIQUE (file_id, chunk_index)
);

-- Exams / upcoming deadlines
CREATE TABLE exams (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    module     TEXT        NOT NULL,
    exam_name  TEXT        NOT NULL,
    exam_date  DATE        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Many-to-many: which topics belong to which exam
CREATE TABLE exam_topics (
    exam_id  UUID NOT NULL REFERENCES exams(id)  ON DELETE CASCADE,
    topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    PRIMARY KEY (exam_id, topic_id)
);

-- SM-2 flashcards (separate SM-2 state from topics)
CREATE TABLE flashcards (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    topic_id          UUID        NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    question          TEXT        NOT NULL,
    answer            TEXT        NOT NULL,
    source            TEXT,       -- 'manual' | 'file_chunk' | 'ai_generated'
    easiness_factor   FLOAT       NOT NULL DEFAULT 2.5,
    sm2_interval      INTEGER     NOT NULL DEFAULT 1,
    sm2_repetitions   INTEGER     NOT NULL DEFAULT 0,
    next_review       DATE        NOT NULL DEFAULT CURRENT_DATE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Study session tracking (start/end + duration)
CREATE TABLE study_sessions (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    topic_id         UUID        REFERENCES topics(id) ON DELETE SET NULL,
    start_time       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_time         TIMESTAMPTZ,
    duration_minutes INTEGER,    -- set by end_study_session endpoint
    quality_score    SMALLINT    CHECK (quality_score BETWEEN 0 AND 5),
    session_type     TEXT        NOT NULL
                                 CHECK (session_type IN ('review','quiz','flashcard','reading','free')),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI-generated quiz questions (Anthropic, per topic)
CREATE TABLE generated_quizzes (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    topic_id      UUID        NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    question      TEXT        NOT NULL,
    answer        TEXT        NOT NULL,
    question_type TEXT        NOT NULL
                              CHECK (question_type IN ('multiple_choice','true_false','short_answer')),
    options       JSONB,      -- null for true_false/short_answer
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 3. UPDATED_AT TRIGGERS
-- ============================================================

CREATE TRIGGER topics_updated_at
    BEFORE UPDATE ON topics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER flashcards_updated_at
    BEFORE UPDATE ON flashcards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER user_settings_updated_at
    BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- 4. ROW LEVEL SECURITY  (every table, no exceptions)
-- ============================================================

ALTER TABLE user_settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics           ENABLE ROW LEVEL SECURITY;
ALTER TABLE cognitive_load   ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_history     ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_streak  ENABLE ROW LEVEL SECURITY;
ALTER TABLE files            ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_chunks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams            ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_topics      ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcards       ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_quizzes ENABLE ROW LEVEL SECURITY;

-- Direct user_id tables: simple ownership policy
CREATE POLICY "user_settings_own"
    ON user_settings FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "topics_own"
    ON topics FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "cognitive_load_own"
    ON cognitive_load FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "quiz_history_own"
    ON quiz_history FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notes_own"
    ON notes FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "learning_streak_own"
    ON learning_streak FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "files_own"
    ON files FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- file_chunks has no user_id — proxy through files
CREATE POLICY "file_chunks_own"
    ON file_chunks FOR ALL
    USING (
        file_id IN (SELECT id FROM files WHERE user_id = auth.uid())
    )
    WITH CHECK (
        file_id IN (SELECT id FROM files WHERE user_id = auth.uid())
    );

CREATE POLICY "exams_own"
    ON exams FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- exam_topics has no user_id — proxy through exams
CREATE POLICY "exam_topics_own"
    ON exam_topics FOR ALL
    USING (
        exam_id IN (SELECT id FROM exams WHERE user_id = auth.uid())
    )
    WITH CHECK (
        exam_id IN (SELECT id FROM exams WHERE user_id = auth.uid())
    );

CREATE POLICY "flashcards_own"
    ON flashcards FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "study_sessions_own"
    ON study_sessions FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "generated_quizzes_own"
    ON generated_quizzes FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);


-- ============================================================
-- 5. INDEXES
-- ============================================================

-- topics: learning queue + module filtering
CREATE INDEX idx_topics_user_id         ON topics(user_id);
CREATE INDEX idx_topics_next_review_due ON topics(user_id, next_review_due);
CREATE INDEX idx_topics_module          ON topics(user_id, module);

-- cognitive_load: time-series queries
CREATE INDEX idx_cognitive_load_user_date ON cognitive_load(user_id, date DESC);

-- quiz_history: analytics + SM-2 lookup
CREATE INDEX idx_quiz_history_user     ON quiz_history(user_id);
CREATE INDEX idx_quiz_history_topic    ON quiz_history(topic_id, date DESC);

-- notes
CREATE INDEX idx_notes_user  ON notes(user_id);
CREATE INDEX idx_notes_topic ON notes(topic_id);

-- learning_streak: streak calendar
CREATE INDEX idx_learning_streak_user_date ON learning_streak(user_id, date DESC);

-- files
CREATE INDEX idx_files_user  ON files(user_id);
CREATE INDEX idx_files_topic ON files(topic_id);

-- file_chunks: chunk lookup + ivfflat vector index
CREATE INDEX idx_file_chunks_file ON file_chunks(file_id);
CREATE INDEX idx_file_chunks_embedding
    ON file_chunks USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- exams: readiness score queries by date
CREATE INDEX idx_exams_user_date ON exams(user_id, exam_date);

-- flashcards: due-review queue
CREATE INDEX idx_flashcards_user_review ON flashcards(user_id, next_review);
CREATE INDEX idx_flashcards_topic       ON flashcards(topic_id);

-- study_sessions: analytics
CREATE INDEX idx_study_sessions_user_time ON study_sessions(user_id, start_time DESC);
CREATE INDEX idx_study_sessions_topic     ON study_sessions(topic_id);

-- generated_quizzes
CREATE INDEX idx_generated_quizzes_user_topic ON generated_quizzes(user_id, topic_id);


-- ============================================================
-- 6. SEMANTIC SEARCH FUNCTION
-- ============================================================
-- Called by FastAPI /search/semantic — returns ranked chunks
-- scoped to the authenticated user's files only.

CREATE OR REPLACE FUNCTION search_file_chunks(
    query_embedding      vector(384),
    match_user_id        UUID,
    match_count          INT     DEFAULT 5,
    similarity_threshold FLOAT   DEFAULT 0.5
)
RETURNS TABLE (
    chunk_id    UUID,
    file_id     UUID,
    chunk_text  TEXT,
    page_number INT,
    similarity  FLOAT,
    filename    TEXT,
    topic_id    UUID
)
LANGUAGE sql STABLE
AS $$
    SELECT
        fc.id                                   AS chunk_id,
        fc.file_id,
        fc.chunk_text,
        fc.page_number,
        1 - (fc.embedding <=> query_embedding)  AS similarity,
        f.filename,
        f.topic_id
    FROM  file_chunks fc
    JOIN  files f ON f.id = fc.file_id
    WHERE f.user_id = match_user_id
      AND fc.embedding IS NOT NULL
      AND 1 - (fc.embedding <=> query_embedding) >= similarity_threshold
    ORDER BY fc.embedding <=> query_embedding
    LIMIT match_count;
$$;


-- ============================================================
-- 7. STORAGE BUCKET PLACEHOLDER COMMENT
-- ============================================================
-- Create these buckets manually in the Supabase Dashboard
-- (Storage → New bucket) or via `supabase storage create`:
--
--   Bucket name : learnos-files
--   Public      : false
--   Allowed MIME: application/pdf, audio/*, text/plain
--
-- Supabase Storage RLS policy for the bucket:
--   SELECT (download): auth.uid() = (storage.foldername(name))[1]::uuid
--   INSERT (upload)  : auth.uid() = (storage.foldername(name))[1]::uuid
--
-- File path convention: {user_id}/{uuid}.{ext}
-- ============================================================
