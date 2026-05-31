/**
 * Typed API client — wraps the FastAPI backend.
 * Automatically attaches the Supabase access token as Bearer.
 */
import { createClient } from '@/lib/supabase'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

// ── Shared types ──────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T | null
  error: string | null
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const authHeader = await getAuthHeader()
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
      ...options.headers,
    },
    ...options,
  })
  return res.json() as Promise<ApiResponse<T>>
}

// ── Topics ────────────────────────────────────────────────────────────────────

export interface Topic {
  id: string
  user_id: string
  name: string
  module: string
  understanding_score: number
  memory_strength: number
  easiness_factor: number
  sm2_interval: number
  sm2_repetitions: number
  last_reviewed: string | null
  next_review_due: string
  prerequisite_topic_id: string | null
  created_at: string
  updated_at: string
}

export const topicsApi = {
  list: (module?: string) =>
    request<Topic[]>(`/topics${module ? `?module=${encodeURIComponent(module)}` : ''}`),

  get: (id: string) => request<Topic>(`/topics/${id}`),

  create: (data: { name: string; module: string; understanding_score: number }) =>
    request<Topic>('/topics', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Partial<Topic>) =>
    request<Topic>(`/topics/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id: string) =>
    request<null>(`/topics/${id}`, { method: 'DELETE' }),

  review: (id: string, quality: number) =>
    request<{ topic: Topic; next_review_due: string; interval_days: number }>(
      `/topics/${id}/review`,
      { method: 'POST', body: JSON.stringify({ quality }) },
    ),

  search: (q: string) =>
    request<Topic[]>(`/topics/search?q=${encodeURIComponent(q)}`),

  files: (id: string) => request<UploadedFile[]>(`/topics/${id}/files`),
}

// ── Queue ─────────────────────────────────────────────────────────────────────

export interface QueueItem {
  topic: Topic
  overdue_days: number
  priority: number
}

export interface LearningQueue {
  items: QueueItem[]
  total_due: number
  cognitive_load_today: number
}

export const queueApi = {
  list: () => request<LearningQueue>('/queue'),
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export interface Exam {
  id: string
  user_id: string
  module: string
  exam_name: string
  exam_date: string
  created_at: string
}

export interface Dashboard {
  due_today: number
  due_flashcards: number
  current_streak: number
  total_topics: number
  study_time_today_minutes: number
  study_time_7d_avg_minutes: number
  next_exam: Exam | null
  readiness_score: number | null
}

export interface ModuleStat {
  module: string
  topic_count: number
  avg_understanding: number
  next_due: string
}

export const analyticsApi = {
  dashboard: () => request<Dashboard>('/analytics/dashboard'),
  streak: () => request<{ date: string; topics_reviewed: number }[]>('/analytics/streak'),
  modules: () => request<ModuleStat[]>('/analytics/modules'),
  quizHistory: () => request<{ date: string; avg_score: number; count: number }[]>('/analytics/quiz-history'),
  topicsDue: () => request<{ bucket: string; count: number }[]>('/analytics/topics-due'),
}

// ── Settings ──────────────────────────────────────────────────────────────────

export const settingsApi = {
  get: () => request<{ has_key: boolean }>('/settings'),
  saveApiKey: (key: string) =>
    request<{ has_key: boolean }>('/settings/api-key', {
      method: 'PUT',
      body: JSON.stringify({ anthropic_api_key: key }),
    }),
  deleteApiKey: () => request<{ has_key: boolean }>('/settings/api-key', { method: 'DELETE' }),
}

// ── Quiz ──────────────────────────────────────────────────────────────────────

export interface QuizOption {
  label: string
  text: string
}

export interface QuizQuestion {
  id: string
  question: string
  answer: string
  question_type: 'multiple_choice' | 'true_false' | 'short_answer'
  options: QuizOption[] | null
}

export const quizApi = {
  generate: (topicId: string, numQuestions = 5) =>
    request<QuizQuestion[]>('/quiz/generate', {
      method: 'POST',
      body: JSON.stringify({
        topic_id: topicId,
        num_questions: numQuestions,
        question_types: ['multiple_choice', 'true_false'],
      }),
    }),
  submitResult: (topicId: string, scorePercent: number) =>
    request<null>('/quiz/result', {
      method: 'POST',
      body: JSON.stringify({ topic_id: topicId, score_percent: scorePercent }),
    }),
}

// ── Exams ─────────────────────────────────────────────────────────────────────

export interface ExamItem {
  id: string
  user_id: string
  module: string
  exam_name: string
  exam_date: string
  created_at: string
}

export interface ReadinessData {
  exam: ExamItem
  readiness_score: number
  problems: string[]
}

export interface ExamTopic {
  id: string
  name: string
  module: string
}

export const examsApi = {
  list: () => request<ExamItem[]>('/exams'),
  create: (data: { module: string; exam_name: string; exam_date: string; topic_ids: string[] }) =>
    request<ExamItem>('/exams', { method: 'POST', body: JSON.stringify(data) }),
  delete: (id: string) => request<null>(`/exams/${id}`, { method: 'DELETE' }),
  topics: (id: string) => request<ExamTopic[]>(`/exams/${id}/topics`),
  readiness: (id: string) => request<ReadinessData>(`/exams/${id}/readiness`),
}

// ── Flashcards ────────────────────────────────────────────────────────────────

export interface Flashcard {
  id: string
  user_id: string
  topic_id: string
  question: string
  answer: string
  source: string | null
  easiness_factor: number
  sm2_interval: number
  sm2_repetitions: number
  next_review: string
  created_at: string
  updated_at: string
}

export const flashcardsApi = {
  list: () => request<Flashcard[]>('/flashcards'),
  due: () => request<Flashcard[]>('/flashcards/due'),
  create: (data: { topic_id: string; question: string; answer: string }) =>
    request<Flashcard>('/flashcards', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { question?: string; answer?: string }) =>
    request<Flashcard>(`/flashcards/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<null>(`/flashcards/${id}`, { method: 'DELETE' }),
  review: (id: string, quality: number) =>
    request<Flashcard>(`/flashcards/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ quality }),
    }),
}

// ── Files ─────────────────────────────────────────────────────────────────────

export interface UploadedFile {
  id: string
  user_id: string
  topic_id: string | null
  filename: string
  file_path: string
  file_type: 'pdf' | 'audio' | 'txt'
  page_count: number | null
  chunk_count: number
  sha256: string
  created_at: string
}

export interface SearchResult {
  chunk_id: string
  file_id: string
  chunk_text: string
  page_number: number | null
  similarity: number
  filename: string
  topic_id: string | null
}

// ── Notes ─────────────────────────────────────────────────────────────────────

export interface Note {
  id: string
  user_id: string
  topic_id: string
  content: string
  created_at: string
  updated_at: string
}

export const notesApi = {
  list: (topicId: string) => request<Note[]>(`/notes?topic_id=${topicId}`),
  create: (topicId: string, content: string) =>
    request<Note>('/notes', { method: 'POST', body: JSON.stringify({ topic_id: topicId, content }) }),
  update: (id: string, content: string) =>
    request<Note>(`/notes/${id}`, { method: 'PUT', body: JSON.stringify({ content }) }),
  delete: (id: string) => request<null>(`/notes/${id}`, { method: 'DELETE' }),
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export interface StudySession {
  id: string
  user_id: string
  topic_id: string | null
  start_time: string
  end_time: string | null
  duration_minutes: number | null
  quality_score: number | null
  session_type: string
  created_at: string
}

export const sessionsApi = {
  start: (data: { session_type: string; topic_id?: string }) =>
    request<StudySession>('/sessions/start', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  end: (id: string, qualityScore?: number) =>
    request<StudySession>(`/sessions/${id}/end`, {
      method: 'POST',
      body: JSON.stringify({ quality_score: qualityScore ?? null }),
    }),
}

// ── Files ─────────────────────────────────────────────────────────────────────

async function uploadRequest(formData: FormData): Promise<ApiResponse<UploadedFile>> {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const res = await fetch(`${BASE_URL}/files/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })
  return res.json()
}

export const sbbApi = {
  connections: (from: string, to: string) =>
    request<{ connections: SbbConnection[] }>(`/sbb/connections?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
}

export interface SbbConnection {
  from: { station: { name: string }; departure: string }
  to: { station: { name: string }; arrival: string }
  duration: string
}

export async function downloadExport(): Promise<void> {
  const authHeader = await getAuthHeader()
  const res = await fetch(`${BASE_URL}/analytics/export`, { headers: authHeader })
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'learnos-export.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export const filesApi = {
  list: () => request<UploadedFile[]>('/files'),

  upload: (file: File, topicId?: string) => {
    const form = new FormData()
    form.append('file', file)
    if (topicId) form.append('topic_id', topicId)
    return uploadRequest(form)
  },

  delete: (id: string) => request<null>(`/files/${id}`, { method: 'DELETE' }),

  search: (query: string, limit = 5, topicId?: string) =>
    request<SearchResult[]>('/files/search', {
      method: 'POST',
      body: JSON.stringify({
        query,
        limit,
        similarity_threshold: 0.5,
        ...(topicId ? { topic_id: topicId } : {}),
      }),
    }),
}
