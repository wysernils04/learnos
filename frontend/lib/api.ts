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
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export interface Dashboard {
  due_today: number
  due_flashcards: number
  current_streak: number
  total_topics: number
  study_time_today_minutes: number
  study_time_7d_avg_minutes: number
  next_exam: unknown | null
  readiness_score: number | null
}

export const analyticsApi = {
  dashboard: () => request<Dashboard>('/analytics/dashboard'),
  streak: () => request<{ date: string; topics_reviewed: number }[]>('/analytics/streak'),
}
