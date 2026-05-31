'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, Pencil, Plus, Trash2 } from 'lucide-react'
import { flashcardsApi, sessionsApi, topicsApi, type Flashcard, type Topic } from '@/lib/api'
import { FlashcardReviewCard } from '@/components/FlashcardReviewCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// ── Card form dialog ──────────────────────────────────────────────────────────

function CardDialog({
  open,
  onClose,
  onSave,
  topics,
  initial,
  saving,
}: {
  open: boolean
  onClose: () => void
  onSave: (data: { topic_id: string; question: string; answer: string }) => void
  topics: Topic[]
  initial?: Flashcard
  saving: boolean
}) {
  const [topicId, setTopicId] = useState(initial?.topic_id ?? topics[0]?.id ?? '')
  const [question, setQuestion] = useState(initial?.question ?? '')
  const [answer, setAnswer] = useState(initial?.answer ?? '')

  function handleSave() {
    if (!topicId || !question.trim() || !answer.trim()) return
    onSave({ topic_id: topicId, question: question.trim(), answer: answer.trim() })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit flashcard' : 'New flashcard'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {!initial && (
            <div className="space-y-1.5">
              <Label htmlFor="topic">Topic</Label>
              <select
                id="topic"
                value={topicId}
                onChange={(e) => setTopicId(e.target.value)}
                className="w-full rounded-xl border border-input bg-white/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} — {t.module}</option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="question">Question</Label>
            <textarea
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={3}
              placeholder="What is…?"
              className="w-full rounded-xl border border-input bg-white/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="answer">Answer</Label>
            <textarea
              id="answer"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={4}
              placeholder="The answer is…"
              className="w-full rounded-xl border border-input bg-white/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSave}
            loading={saving}
            disabled={saving || !topicId || !question.trim() || !answer.trim()}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Manage list row ───────────────────────────────────────────────────────────

function CardRow({
  card,
  topicName,
  onEdit,
  onDelete,
}: {
  card: Flashcard
  topicName: string
  onEdit: () => void
  onDelete: () => void
}) {
  const isOverdue = new Date(card.next_review) <= new Date()
  return (
    <div className="rounded-xl border border-white/50 bg-white/80 px-4 py-3 backdrop-blur-sm hover:shadow-glass transition-shadow duration-200">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-primary-900 line-clamp-2">{card.question}</p>
          <p className="mt-1 text-xs text-muted-foreground line-clamp-1">{card.answer}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">{topicName}</span>
            <span className={`rounded-lg px-2 py-0.5 text-xs font-medium ${isOverdue ? 'bg-orange-100 text-orange-700' : 'bg-primary-50 text-primary-700'}`}>
              {isOverdue ? 'Due' : `In ${Math.ceil((new Date(card.next_review).getTime() - Date.now()) / 86_400_000)}d`}
            </span>
            <span className="text-xs text-muted-foreground">EF {card.easiness_factor.toFixed(2)}</span>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={onEdit} className="cursor-pointer rounded-lg p-1.5 text-muted-foreground hover:bg-primary-50 hover:text-primary-700 transition-colors duration-150" aria-label="Edit">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={onDelete} className="cursor-pointer rounded-lg p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors duration-150" aria-label="Delete">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = 'review' | 'manage'

export default function FlashcardsPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('review')
  const [reviewIndex, setReviewIndex] = useState(0)
  const [done, setDone] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editCard, setEditCard] = useState<Flashcard | undefined>()
  const sessionIdRef = useRef<string | null>(null)
  const sessionEndedRef = useRef(false)

  const { data: dueCards = [], isLoading: dueLoading } = useQuery({
    queryKey: ['flashcards-due'],
    queryFn: () => flashcardsApi.due().then((r) => r.data ?? []),
  })

  const { data: allCards = [], isLoading: allLoading } = useQuery({
    queryKey: ['flashcards'],
    queryFn: () => flashcardsApi.list().then((r) => r.data ?? []),
  })

  const { data: topics = [] } = useQuery({
    queryKey: ['topics'],
    queryFn: () => topicsApi.list().then((r) => r.data ?? []),
  })

  const topicMap = Object.fromEntries(topics.map((t) => [t.id, t.name]))

  // Start a flashcard session when the review tab has due cards; end on unmount or when done
  useEffect(() => {
    if (tab !== 'review' || dueCards.length === 0) return
    sessionEndedRef.current = false
    sessionsApi.start({ session_type: 'flashcard' }).then((r) => {
      if (r.data) sessionIdRef.current = r.data.id
    })
    return () => {
      if (sessionIdRef.current && !sessionEndedRef.current) {
        sessionEndedRef.current = true
        sessionsApi.end(sessionIdRef.current)
      }
    }
  }, [tab, dueCards.length])

  useEffect(() => {
    if (done && sessionIdRef.current && !sessionEndedRef.current) {
      sessionEndedRef.current = true
      sessionsApi.end(sessionIdRef.current).then(() => {
        qc.invalidateQueries({ queryKey: ['dashboard'] })
      })
    }
  }, [done, qc])

  const reviewCard = useMutation({
    mutationFn: ({ id, quality }: { id: string; quality: number }) =>
      flashcardsApi.review(id, quality),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['flashcards-due'] })
      qc.invalidateQueries({ queryKey: ['flashcards'] })
      if (reviewIndex + 1 >= dueCards.length) {
        setDone(true)
      } else {
        setReviewIndex((i) => i + 1)
      }
    },
  })

  const createCard = useMutation({
    mutationFn: flashcardsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['flashcards'] })
      qc.invalidateQueries({ queryKey: ['flashcards-due'] })
      setDialogOpen(false)
    },
  })

  const updateCard = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { question?: string; answer?: string } }) =>
      flashcardsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['flashcards'] })
      setEditCard(undefined)
    },
  })

  const deleteCard = useMutation({
    mutationFn: flashcardsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flashcards'] }),
  })

  function startReview() {
    setReviewIndex(0)
    setDone(false)
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header + tabs */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-primary-900">Flashcards</h1>
        <div className="flex gap-1 rounded-xl border border-primary-100 bg-primary-50 p-1">
          {(['review', 'manage'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`cursor-pointer rounded-lg px-4 py-1.5 text-sm font-medium transition-colors duration-150 capitalize ${
                tab === t
                  ? 'bg-white text-primary-800 shadow-sm'
                  : 'text-muted-foreground hover:text-primary-700'
              }`}
            >
              {t}
              {t === 'review' && dueCards.length > 0 && (
                <span className="ml-1.5 rounded-full bg-cta px-1.5 py-0.5 text-xs font-bold text-white">
                  {dueCards.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Review tab */}
      {tab === 'review' && (
        <div>
          {dueLoading ? (
            <div className="h-48 animate-pulse rounded-2xl bg-primary-50" />
          ) : dueCards.length === 0 || done ? (
            <Card className="bg-white/80 backdrop-blur-md border-white/50 shadow-glass rounded-2xl">
              <CardContent className="flex flex-col items-center gap-4 py-16">
                <CheckCircle className="h-12 w-12 text-primary-400" />
                <div className="text-center">
                  <p className="text-lg font-bold text-primary-900">All caught up!</p>
                  <p className="mt-1 text-sm text-muted-foreground">No flashcards due right now.</p>
                </div>
                <Button variant="outline" onClick={() => setTab('manage')}>
                  Manage cards
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Progress bar */}
              <div className="h-1.5 w-full rounded-full bg-primary-100">
                <div
                  className="h-1.5 rounded-full bg-primary-500 transition-all duration-300"
                  style={{ width: `${(reviewIndex / dueCards.length) * 100}%` }}
                />
              </div>
              <FlashcardReviewCard
                key={dueCards[reviewIndex].id}
                card={dueCards[reviewIndex]}
                position={reviewIndex + 1}
                total={dueCards.length}
                topicName={topicMap[dueCards[reviewIndex].topic_id]}
                onReviewed={(id, quality) => reviewCard.mutate({ id, quality })}
                isPending={reviewCard.isPending}
              />
            </div>
          )}
        </div>
      )}

      {/* Manage tab */}
      {tab === 'manage' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setDialogOpen(true)} disabled={topics.length === 0}>
              <Plus className="h-4 w-4 mr-1.5" />
              New card
            </Button>
          </div>

          {topics.length === 0 && (
            <p className="text-sm text-muted-foreground">Create a topic first before adding flashcards.</p>
          )}

          {allLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-primary-50" />)}
            </div>
          ) : allCards.length === 0 ? (
            <Card className="bg-white/80 backdrop-blur-md border-white/50 shadow-glass rounded-2xl">
              <CardContent className="py-12 text-center">
                <p className="text-sm text-muted-foreground">No flashcards yet — create one above.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {allCards.map((card) => (
                <CardRow
                  key={card.id}
                  card={card}
                  topicName={topicMap[card.topic_id] ?? 'Unknown topic'}
                  onEdit={() => setEditCard(card)}
                  onDelete={() => deleteCard.mutate(card.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create dialog */}
      {dialogOpen && (
        <CardDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onSave={(data) => createCard.mutate(data)}
          topics={topics}
          saving={createCard.isPending}
        />
      )}

      {/* Edit dialog */}
      {editCard && (
        <CardDialog
          open={!!editCard}
          onClose={() => setEditCard(undefined)}
          onSave={(data) => updateCard.mutate({ id: editCard.id, data })}
          topics={topics}
          initial={editCard}
          saving={updateCard.isPending}
        />
      )}
    </div>
  )
}
