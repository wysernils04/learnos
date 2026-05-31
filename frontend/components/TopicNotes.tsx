'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, StickyNote, Trash2, X, Check } from 'lucide-react'
import { notesApi, type Note } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

interface Props {
  topicId: string
}

export function TopicNotes({ topicId }: Props) {
  const qc = useQueryClient()
  const [draft, setDraft] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['notes', topicId],
    queryFn: () => notesApi.list(topicId).then((r) => r.data ?? []),
  })

  const createNote = useMutation({
    mutationFn: () => notesApi.create(topicId, draft.trim()),
    onSuccess: () => {
      setDraft('')
      qc.invalidateQueries({ queryKey: ['notes', topicId] })
    },
  })

  const updateNote = useMutation({
    mutationFn: (id: string) => notesApi.update(id, editContent.trim()),
    onSuccess: () => {
      setEditId(null)
      qc.invalidateQueries({ queryKey: ['notes', topicId] })
    },
  })

  const deleteNote = useMutation({
    mutationFn: notesApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes', topicId] }),
  })

  function startEdit(note: Note) {
    setEditId(note.id)
    setEditContent(note.content)
  }

  return (
    <Card className="bg-white/80 backdrop-blur-md border-white/50 shadow-glass rounded-2xl">
      <CardContent className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-primary-500" />
          <h2 className="text-sm font-semibold text-primary-800">Notes</h2>
          {notes.length > 0 && (
            <span className="ml-auto text-xs text-muted-foreground">{notes.length}</span>
          )}
        </div>

        {/* New note input */}
        <div className="mb-4 space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a note…"
            rows={3}
            className="w-full rounded-xl border border-input bg-white/80 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && draft.trim()) {
                createNote.mutate()
              }
            }}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">⌘↵ to save</span>
            <Button
              size="sm"
              onClick={() => createNote.mutate()}
              disabled={!draft.trim() || createNote.isPending}
              loading={createNote.isPending}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add note
            </Button>
          </div>
        </div>

        {/* Note list */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-primary-50" />)}
          </div>
        ) : notes.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No notes yet.</p>
        ) : (
          <div className="space-y-2">
            {notes.map((note) => (
              <div
                key={note.id}
                className="group rounded-xl border border-primary-100 bg-primary-50/60 px-4 py-3"
              >
                {editId === note.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={3}
                      autoFocus
                      className="w-full rounded-xl border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setEditId(null)}
                        className="cursor-pointer rounded-lg p-1.5 text-muted-foreground hover:bg-primary-100 transition-colors duration-150"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => updateNote.mutate(note.id)}
                        disabled={!editContent.trim() || updateNote.isPending}
                        className="cursor-pointer rounded-lg p-1.5 text-primary-600 hover:bg-primary-100 transition-colors duration-150 disabled:opacity-40"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <p className="flex-1 text-sm text-primary-900 whitespace-pre-wrap leading-relaxed">
                      {note.content}
                    </p>
                    <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      <button
                        onClick={() => startEdit(note)}
                        className="cursor-pointer rounded-lg p-1.5 text-muted-foreground hover:bg-primary-100 hover:text-primary-700 transition-colors duration-150"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => deleteNote.mutate(note.id)}
                        className="cursor-pointer rounded-lg p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors duration-150"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
                <p className="mt-1 text-xs text-muted-foreground">{formatRelative(note.updated_at)}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
