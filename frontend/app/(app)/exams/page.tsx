'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Calendar, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { examsApi, topicsApi, type ExamItem, type ReadinessData, type Topic } from '@/lib/api'
import { ReadinessGauge } from '@/components/ReadinessGauge'
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
import { cn } from '@/lib/utils'

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string) {
  const exam = new Date(dateStr)
  exam.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((exam.getTime() - today.getTime()) / 86_400_000)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function CountdownBadge({ dateStr }: { dateStr: string }) {
  const days = daysUntil(dateStr)
  if (days < 0) return <span className="rounded-lg bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">Past</span>
  if (days === 0) return <span className="rounded-lg bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">Today!</span>
  if (days <= 3) return <span className="rounded-lg bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600">{days}d left</span>
  if (days <= 7) return <span className="rounded-lg bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-700">{days}d left</span>
  return <span className="rounded-lg bg-primary-50 px-2.5 py-0.5 text-xs font-semibold text-primary-700">{days}d left</span>
}

// ── Create exam dialog ────────────────────────────────────────────────────────

function CreateExamDialog({
  open,
  onClose,
  onSave,
  topics,
  saving,
}: {
  open: boolean
  onClose: () => void
  onSave: (data: { module: string; exam_name: string; exam_date: string; topic_ids: string[] }) => void
  topics: Topic[]
  saving: boolean
}) {
  const [name, setName] = useState('')
  const [module, setModule] = useState('')
  const [date, setDate] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  function toggle(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const modules = topics.map((t) => t.module).filter((m, i, arr) => arr.indexOf(m) === i).sort()

  function handleSave() {
    if (!name.trim() || !module.trim() || !date) return
    onSave({ exam_name: name.trim(), module: module.trim(), exam_date: date, topic_ids: selectedIds })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>New exam</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="exam-name">Exam name</Label>
            <Input id="exam-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Analysis II — Final" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="module">Module</Label>
            <Input
              id="module"
              value={module}
              onChange={(e) => setModule(e.target.value)}
              placeholder="Mathematics"
              list="modules-list"
            />
            <datalist id="modules-list">
              {modules.map((m) => <option key={m} value={m} />)}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="exam-date">Exam date</Label>
            <Input id="exam-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Topics ({selectedIds.length} selected)</Label>
            <div className="max-h-48 overflow-y-auto rounded-xl border border-input p-2 space-y-1">
              {topics.length === 0 ? (
                <p className="text-xs text-muted-foreground px-2 py-1">No topics yet.</p>
              ) : (
                topics.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggle(t.id)}
                    className={cn(
                      'w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors duration-150 cursor-pointer',
                      selectedIds.includes(t.id)
                        ? 'bg-primary-100 text-primary-800'
                        : 'hover:bg-primary-50 text-foreground',
                    )}
                  >
                    <span className={cn(
                      'h-4 w-4 shrink-0 rounded border-2 transition-colors duration-150',
                      selectedIds.includes(t.id) ? 'border-primary-600 bg-primary-600' : 'border-input',
                    )} />
                    <span className="flex-1 truncate">{t.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{t.module}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSave}
            loading={saving}
            disabled={saving || !name.trim() || !module.trim() || !date}
          >
            Create exam
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Exam card ─────────────────────────────────────────────────────────────────

function ExamCard({ exam, onDelete }: { exam: ExamItem; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false)

  const { data: readiness, isLoading } = useQuery({
    queryKey: ['exam-readiness', exam.id],
    queryFn: () => examsApi.readiness(exam.id).then((r) => r.data ?? null),
    enabled: expanded,
  })

  return (
    <Card className="bg-white/80 backdrop-blur-md border-white/50 shadow-glass rounded-2xl overflow-hidden">
      <CardContent className="p-0">
        {/* Header row */}
        <div className="flex items-center gap-4 p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100">
            <Calendar className="h-5 w-5 text-primary-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-primary-900 truncate">{exam.exam_name}</p>
            <p className="text-xs text-muted-foreground">{exam.module} · {formatDate(exam.exam_date)}</p>
          </div>
          <CountdownBadge dateStr={exam.exam_date} />
          <button
            onClick={() => setExpanded((v) => !v)}
            className="cursor-pointer rounded-lg p-1.5 text-muted-foreground hover:bg-primary-50 hover:text-primary-700 transition-colors duration-150"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button
            onClick={onDelete}
            className="cursor-pointer rounded-lg p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors duration-150"
            aria-label="Delete exam"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {/* Expanded readiness panel */}
        {expanded && (
          <div className="border-t border-primary-50 px-5 pb-5 pt-4">
            {isLoading ? (
              <div className="h-32 animate-pulse rounded-xl bg-primary-50" />
            ) : readiness ? (
              <ReadinessDetail readiness={readiness} />
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ReadinessDetail({ readiness }: { readiness: ReadinessData }) {
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
      <div className="flex justify-center">
        <ReadinessGauge score={readiness.readiness_score} size={140} />
      </div>

      {readiness.problems.length > 0 ? (
        <div className="flex-1 space-y-2">
          <p className="text-xs font-semibold text-primary-700">Issues to address</p>
          {readiness.problems.map((p, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg border border-orange-100 bg-orange-50 px-3 py-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-500" />
              <p className="text-xs text-orange-800">{p}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex items-center">
          <p className="text-sm text-primary-600 font-medium">All topics on track for this exam.</p>
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ExamsPage() {
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data: exams = [], isLoading } = useQuery({
    queryKey: ['exams'],
    queryFn: () => examsApi.list().then((r) => Array.isArray(r.data) ? r.data : []),
  })

  const { data: topics = [] } = useQuery({
    queryKey: ['topics'],
    queryFn: () => topicsApi.list().then((r) => Array.isArray(r.data) ? r.data : []),
  })

  const createExam = useMutation({
    mutationFn: examsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exams'] })
      setDialogOpen(false)
    },
  })

  const deleteExam = useMutation({
    mutationFn: examsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exams'] }),
  })

  const upcoming = exams.filter((e) => daysUntil(e.exam_date) >= 0)
  const past = exams.filter((e) => daysUntil(e.exam_date) < 0)

  return (
    <div className="space-y-8 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary-900">Exams</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track upcoming exams and your readiness score per topic.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          New exam
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-primary-50" />)}
        </div>
      ) : exams.length === 0 ? (
        <Card className="bg-white/80 backdrop-blur-md border-white/50 shadow-glass rounded-2xl">
          <CardContent className="py-16 text-center">
            <Calendar className="mx-auto mb-3 h-10 w-10 text-primary-200" />
            <p className="text-sm text-muted-foreground">No exams yet — add one to track your readiness.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {upcoming.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Upcoming</h2>
              {upcoming.map((exam) => (
                <ExamCard key={exam.id} exam={exam} onDelete={() => deleteExam.mutate(exam.id)} />
              ))}
            </section>
          )}
          {past.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Past</h2>
              {past.map((exam) => (
                <ExamCard key={exam.id} exam={exam} onDelete={() => deleteExam.mutate(exam.id)} />
              ))}
            </section>
          )}
        </div>
      )}

      {dialogOpen && (
        <CreateExamDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onSave={(data) => createExam.mutate(data)}
          topics={topics}
          saving={createExam.isPending}
        />
      )}
    </div>
  )
}
