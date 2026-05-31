'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { BookOpen, Pencil, Plus, Search, Trash2 } from 'lucide-react'

import { topicsApi, type Topic } from '@/lib/api'
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

// ── Form schema ───────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, 'Required').max(255),
  module: z.string().min(1, 'Required').max(255),
  understanding_score: z.number().int().min(1).max(5),
})
type FormValues = z.infer<typeof schema>

// ── Helpers ───────────────────────────────────────────────────────────────────

function dueBadge(dateStr: string) {
  const due = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)
  const diff = Math.round((due.getTime() - today.getTime()) / 86_400_000)

  if (diff < 0)
    return { label: `${Math.abs(diff)}d overdue`, cls: 'bg-red-100 text-red-700' }
  if (diff === 0)
    return { label: 'Due today', cls: 'bg-orange-100 text-orange-700' }
  if (diff === 1)
    return { label: 'Tomorrow', cls: 'bg-yellow-100 text-yellow-700' }
  return { label: `In ${diff}d`, cls: 'bg-primary-50 text-primary-700' }
}

const SCORE_LABELS: Record<number, string> = {
  1: 'Confused',
  2: 'Vague',
  3: 'Okay',
  4: 'Good',
  5: 'Solid',
}

// ── Topic row ─────────────────────────────────────────────────────────────────

function TopicRow({
  topic,
  onEdit,
  onDelete,
}: {
  topic: Topic
  onEdit: () => void
  onDelete: () => void
}) {
  const badge = dueBadge(topic.next_review_due)

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center gap-4">
          {/* Understanding dots */}
          <div className="flex gap-1 flex-shrink-0" aria-label={`Understanding: ${topic.understanding_score}/5`}>
            {[1, 2, 3, 4, 5].map((n) => (
              <div
                key={n}
                className={`w-2.5 h-2.5 rounded-full ${
                  n <= topic.understanding_score ? 'bg-primary-600' : 'bg-primary-100'
                }`}
              />
            ))}
          </div>

          {/* Name + module */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate">{topic.name}</p>
            <p className="text-xs text-muted-foreground truncate">{topic.module}</p>
          </div>

          {/* SM-2 interval */}
          <div className="hidden sm:block text-right flex-shrink-0">
            <p className="text-xs text-muted-foreground">interval</p>
            <p className="text-sm font-medium text-foreground">
              {topic.sm2_interval}d
            </p>
          </div>

          {/* Due badge */}
          <span className={`flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${badge.cls}`}>
            {badge.label}
          </span>

          {/* Actions */}
          <div className="flex gap-1 flex-shrink-0">
            <button
              onClick={onEdit}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-primary-600 hover:bg-primary-50 transition-colors cursor-pointer"
              aria-label="Edit topic"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
              aria-label="Delete topic"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Create / edit dialog ──────────────────────────────────────────────────────

function TopicDialog({
  open,
  editing,
  existingModules,
  isPending,
  onClose,
  onSubmit,
}: {
  open: boolean
  editing: Topic | null
  existingModules: string[]
  isPending: boolean
  onClose: () => void
  onSubmit: (values: FormValues) => void
}) {
  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } =
    useForm<FormValues>({
      resolver: zodResolver(schema),
      defaultValues: { understanding_score: 3 },
    })

  const score = watch('understanding_score')

  // Populate form when editing
  useState(() => {
    if (editing) {
      reset({
        name: editing.name,
        module: editing.module,
        understanding_score: editing.understanding_score,
      })
    } else {
      reset({ name: '', module: '', understanding_score: 3 })
    }
  })

  // Reset when dialog opens with new data
  const [lastEditing, setLastEditing] = useState<string | null>(null)
  if ((editing?.id ?? null) !== lastEditing) {
    setLastEditing(editing?.id ?? null)
    if (editing) {
      reset({ name: editing.name, module: editing.module, understanding_score: editing.understanding_score })
    } else {
      reset({ name: '', module: '', understanding_score: 3 })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit topic' : 'Log a lecture'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="topic-name">Topic name</Label>
            <Input
              id="topic-name"
              placeholder="e.g. Krebs cycle, Keynesian economics"
              {...register('name')}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="topic-module">Module</Label>
            <Input
              id="topic-module"
              placeholder="e.g. Biology 101"
              list="modules-list"
              {...register('module')}
            />
            <datalist id="modules-list">
              {existingModules.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            {errors.module && (
              <p className="text-xs text-destructive">{errors.module.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>How well do you understand this?</Label>
            <div className="flex gap-2">
              {([1, 2, 3, 4, 5] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setValue('understanding_score', n)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
                    score === n
                      ? 'bg-primary-600 border-primary-600 text-white'
                      : 'border-primary-100 text-muted-foreground hover:border-primary-300 hover:text-primary-700'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              {SCORE_LABELS[score] ?? ''}
            </p>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} loading={isPending}>
              {editing ? 'Save changes' : 'Log lecture'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TopicsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [moduleFilter, setModuleFilter] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Topic | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['topics'],
    queryFn: () => topicsApi.list(),
    staleTime: 30_000,
  })

  const topics: Topic[] = data?.data ?? []
  const modules = Array.from(new Set(topics.map((t) => t.module))).sort()

  const filtered = topics.filter((t) => {
    const q = search.toLowerCase()
    const matchesSearch = !q || t.name.toLowerCase().includes(q) || t.module.toLowerCase().includes(q)
    const matchesModule = !moduleFilter || t.module === moduleFilter
    return matchesSearch && matchesModule
  })

  const createMutation = useMutation({
    mutationFn: topicsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['topics'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setDialogOpen(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Topic> }) =>
      topicsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['topics'] })
      setDialogOpen(false)
      setEditingTopic(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => topicsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['topics'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setDeleteTarget(null)
    },
  })

  function openCreate() {
    setEditingTopic(null)
    setDialogOpen(true)
  }

  function openEdit(topic: Topic) {
    setEditingTopic(topic)
    setDialogOpen(true)
  }

  function handleFormSubmit(values: FormValues) {
    if (editingTopic) {
      updateMutation.mutate({ id: editingTopic.id, data: values })
    } else {
      createMutation.mutate(values)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary-900">Topics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {topics.length} topic{topics.length !== 1 ? 's' : ''} tracked
          </p>
        </div>
        <Button onClick={openCreate} className="bg-cta hover:bg-cta/90 text-white">
          <Plus className="w-4 h-4 mr-1.5" aria-hidden="true" />
          Log lecture
        </Button>
      </div>

      {/* Search + module filter */}
      {topics.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              placeholder="Search topics or modules…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setModuleFilter(null)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${
                !moduleFilter
                  ? 'bg-primary-600 text-white'
                  : 'bg-primary-50 text-primary-700 hover:bg-primary-100'
              }`}
            >
              All
            </button>
            {modules.map((m) => (
              <button
                key={m}
                onClick={() => setModuleFilter(moduleFilter === m ? null : m)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${
                  moduleFilter === m
                    ? 'bg-primary-600 text-white'
                    : 'bg-primary-50 text-primary-700 hover:bg-primary-100'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="py-4">
                <div className="h-10 bg-primary-50 rounded-xl animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-3">
            <BookOpen className="w-10 h-10 text-muted-foreground" aria-hidden="true" />
            <p className="text-muted-foreground text-sm text-center">
              {topics.length === 0
                ? "No topics yet. Log your first lecture to start your learning queue."
                : "No topics match your search."}
            </p>
            {topics.length === 0 && (
              <Button onClick={openCreate} className="mt-1 bg-cta hover:bg-cta/90 text-white">
                <Plus className="w-4 h-4 mr-1.5" />
                Log lecture
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((topic) => (
            <TopicRow
              key={topic.id}
              topic={topic}
              onEdit={() => openEdit(topic)}
              onDelete={() => setDeleteTarget(topic)}
            />
          ))}
        </div>
      )}

      {/* Create / edit dialog */}
      <TopicDialog
        open={dialogOpen}
        editing={editingTopic}
        existingModules={modules}
        isPending={createMutation.isPending || updateMutation.isPending}
        onClose={() => { setDialogOpen(false); setEditingTopic(null) }}
        onSubmit={handleFormSubmit}
      />

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete topic?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">{deleteTarget?.name}</strong> and all its SM-2
            history will be permanently deleted.
          </p>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
