'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  FileText,
  Music,
  Search,
  Sparkles,
  X,
} from 'lucide-react'
import { filesApi, quizApi, topicsApi, type QuizQuestion, type SearchResult, type UploadedFile } from '@/lib/api'
import { QuizRunner } from '@/components/QuizRunner'
import { TopicNotes } from '@/components/TopicNotes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// ── Helpers ───────────────────────────────────────────────────────────────────

const SCORE_LABELS: Record<number, string> = {
  1: 'Confused', 2: 'Vague', 3: 'Okay', 4: 'Good', 5: 'Solid',
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function dueBadge(dateStr: string) {
  const due = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)
  const diff = Math.round((due.getTime() - today.getTime()) / 86_400_000)
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, cls: 'bg-red-100 text-red-700' }
  if (diff === 0) return { label: 'Due today', cls: 'bg-orange-100 text-orange-700' }
  if (diff === 1) return { label: 'Tomorrow', cls: 'bg-yellow-100 text-yellow-700' }
  return { label: `In ${diff}d`, cls: 'bg-primary-50 text-primary-700' }
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/50 bg-white/60 px-4 py-3 backdrop-blur-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-bold text-primary-900">{value}</p>
    </div>
  )
}

function FileChip({ file }: { file: UploadedFile }) {
  const isAudio = file.file_type === 'audio'
  return (
    <div className="flex items-center gap-2 rounded-lg border border-primary-100 bg-primary-50 px-3 py-1.5">
      {isAudio
        ? <Music className="h-3.5 w-3.5 text-primary-500" />
        : <FileText className="h-3.5 w-3.5 text-primary-500" />}
      <span className="max-w-[160px] truncate text-xs font-medium text-primary-800">
        {file.filename}
      </span>
      {file.chunk_count > 0 && (
        <span className="text-xs text-muted-foreground">{file.chunk_count} chunks</span>
      )}
    </div>
  )
}

function SearchResultCard({ result }: { result: SearchResult }) {
  const pct = Math.round(result.similarity * 100)
  return (
    <div className="rounded-xl border border-white/50 bg-white/80 p-4 backdrop-blur-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="truncate text-xs font-semibold text-primary-700">{result.filename}</span>
        <span className={cn(
          'shrink-0 rounded-lg px-2 py-0.5 text-xs font-semibold',
          pct >= 80 ? 'bg-primary-100 text-primary-700' :
          pct >= 60 ? 'bg-yellow-100 text-yellow-700' :
          'bg-slate-100 text-slate-600',
        )}>
          {pct}%
        </span>
      </div>
      {result.page_number != null && (
        <p className="mb-1 text-xs text-muted-foreground">Page {result.page_number}</p>
      )}
      <p className="text-sm leading-relaxed text-primary-900 line-clamp-4">{result.chunk_text}</p>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TopicDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [query, setQuery] = useState('')
  const [scopedToTopic, setScopedToTopic] = useState(true)
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[] | null>(null)
  const [quizScore, setQuizScore] = useState<number | null>(null)

  const { data: topic, isLoading: topicLoading } = useQuery({
    queryKey: ['topic', id],
    queryFn: () => topicsApi.get(id).then((r) => r.data),
    enabled: !!id,
  })

  const { data: files } = useQuery({
    queryKey: ['topic-files', id],
    queryFn: () => topicsApi.files(id).then((r) => Array.isArray(r.data) ? r.data : []),
    enabled: !!id,
  })

  const generateQuiz = useMutation({
    mutationFn: () => quizApi.generate(id),
    onSuccess: (res) => {
      setQuizQuestions(res.data ?? [])
      setQuizScore(null)
    },
  })

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    const res = await filesApi.search(query.trim(), 8, scopedToTopic ? id : undefined)
    setSearchResults(res.data ?? [])
    setSearching(false)
  }

  if (topicLoading || !topic) {
    return (
      <div className="space-y-4 p-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-primary-50" />
        ))}
      </div>
    )
  }

  const badge = dueBadge(topic.next_review_due)

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => router.back()}
          className="mt-1 cursor-pointer rounded-lg p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-primary-50 hover:text-primary-700"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-primary-900">{topic.name}</h1>
            <span className={cn('rounded-lg px-2.5 py-0.5 text-xs font-semibold', badge.cls)}>
              {badge.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{topic.module}</p>
        </div>
      </div>

      {/* SM-2 stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Understanding" value={`${SCORE_LABELS[topic.understanding_score]} (${topic.understanding_score}/5)`} />
        <StatCard label="EF" value={topic.easiness_factor.toFixed(2)} />
        <StatCard label="Interval" value={`${topic.sm2_interval}d`} />
        <StatCard label="Last reviewed" value={formatDate(topic.last_reviewed)} />
      </div>

      {/* Linked files */}
      {files && files.length > 0 && (
        <Card className="bg-white/80 backdrop-blur-md border-white/50 shadow-glass rounded-2xl">
          <CardContent className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary-500" />
              <h2 className="text-sm font-semibold text-primary-800">Linked files</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {files.map((f) => <FileChip key={f.id} file={f} />)}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Semantic search */}
      <Card className="bg-white/80 backdrop-blur-md border-white/50 shadow-glass rounded-2xl">
        <CardContent className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Search className="h-4 w-4 text-primary-500" />
            <h2 className="text-sm font-semibold text-primary-800">Search your notes</h2>
          </div>

          <form onSubmit={handleSearch} className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="What do you want to find?"
                className="flex-1"
              />
              <Button type="submit" loading={searching} disabled={searching || !query.trim()}>
                Search
              </Button>
              {searchResults !== null && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setSearchResults(null); setQuery('') }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Scope toggle */}
            {files && files.length > 0 && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setScopedToTopic(true)}
                  className={cn(
                    'cursor-pointer rounded-lg px-3 py-1 text-xs font-medium transition-colors duration-150',
                    scopedToTopic
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-muted-foreground hover:bg-primary-50',
                  )}
                >
                  This topic only
                </button>
                <button
                  type="button"
                  onClick={() => setScopedToTopic(false)}
                  className={cn(
                    'cursor-pointer rounded-lg px-3 py-1 text-xs font-medium transition-colors duration-150',
                    !scopedToTopic
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-muted-foreground hover:bg-primary-50',
                  )}
                >
                  All files
                </button>
              </div>
            )}
          </form>

          {searchResults !== null && (
            <div className="mt-4 space-y-3">
              {searchResults.length === 0 ? (
                <p className="text-sm text-muted-foreground">No results found.</p>
              ) : (
                searchResults.map((r) => (
                  <SearchResultCard key={r.chunk_id} result={r} />
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Auto quiz */}
      <Card className="bg-white/80 backdrop-blur-md border-white/50 shadow-glass rounded-2xl">
        <CardContent className="p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary-500" />
              <h2 className="text-sm font-semibold text-primary-800">AI quiz</h2>
            </div>
            {!quizQuestions && (
              <Button
                size="sm"
                onClick={() => generateQuiz.mutate()}
                loading={generateQuiz.isPending}
                disabled={generateQuiz.isPending}
              >
                Generate quiz
              </Button>
            )}
            {quizQuestions && !quizScore && (
              <Button size="sm" variant="outline" onClick={() => setQuizQuestions(null)}>
                Cancel
              </Button>
            )}
          </div>

          {generateQuiz.isError && (
            <p className="text-xs text-destructive">
              {(generateQuiz.error as { message?: string })?.message ?? 'Generation failed. Check your API key in Settings.'}
            </p>
          )}

          {!quizQuestions && !generateQuiz.isPending && (
            <p className="text-xs text-muted-foreground">
              Generate questions from your uploaded notes using Claude AI.
              Requires an Anthropic API key in{' '}
              <a href="/settings" className="text-primary-600 underline hover:text-primary-800">Settings</a>.
            </p>
          )}

          {generateQuiz.isPending && (
            <div className="space-y-2">
              {[1,2,3].map((i) => <div key={i} className="h-8 animate-pulse rounded-lg bg-primary-50" />)}
            </div>
          )}

          {quizQuestions && quizScore === null && (
            <QuizRunner
              questions={quizQuestions}
              topicId={id}
              onFinish={(pct) => { setQuizScore(pct); setQuizQuestions(null) }}
            />
          )}

          {quizScore !== null && (
            <div className="flex flex-col items-center gap-3 py-4">
              <p className="text-3xl font-bold text-primary-900">{quizScore}%</p>
              <p className="text-sm text-muted-foreground">
                {quizScore >= 85 ? 'Excellent! ' : quizScore >= 60 ? 'Good work. ' : 'Keep studying. '}
                Score recorded.
              </p>
              <Button variant="outline" size="sm" onClick={() => { setQuizScore(null) }}>
                Try again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <TopicNotes topicId={id} />

      {/* Next review */}
      <div className="flex items-center gap-2 rounded-xl border border-primary-100 bg-primary-50/60 px-4 py-3">
        <Calendar className="h-4 w-4 text-primary-500" />
        <p className="text-sm text-primary-800">
          Next review: <span className="font-semibold">{formatDate(topic.next_review_due)}</span>
        </p>
      </div>
    </div>
  )
}
