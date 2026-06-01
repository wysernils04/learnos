'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, Music, Search, Trash2, X } from 'lucide-react'
import { filesApi, type SearchResult, type UploadedFile } from '@/lib/api'
import { FileUploadZone } from '@/components/FileUploadZone'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// ── Helpers ───────────────────────────────────────────────────────────────────

function FileTypeIcon({ type }: { type: UploadedFile['file_type'] }) {
  if (type === 'audio') return <Music className="h-5 w-5 text-primary-500" />
  return <FileText className="h-5 w-5 text-primary-500" />
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function FileRow({ file, onDelete }: { file: UploadedFile; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/50 bg-white/80 px-4 py-3 backdrop-blur-sm transition-shadow duration-200 hover:shadow-glass">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50">
        <FileTypeIcon type={file.file_type} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-primary-900">{file.filename}</p>
        <p className="text-xs text-muted-foreground">
          {file.file_type.toUpperCase()}
          {file.page_count != null && ` · ${file.page_count} pages`}
          {file.chunk_count > 0 && ` · ${file.chunk_count} chunks`}
          {' · '}{formatDate(file.created_at)}
        </p>
      </div>
      <button
        onClick={onDelete}
        className="cursor-pointer rounded-lg p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-red-50 hover:text-red-600"
        aria-label="Delete file"
      >
        <Trash2 className="h-4 w-4" />
      </button>
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
          'bg-slate-100 text-slate-600'
        )}>
          {pct}% match
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

export default function FilesPage() {
  const qc = useQueryClient()
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null)
  const [searching, setSearching] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['files'],
    queryFn: () => filesApi.list().then((r) => Array.isArray(r.data) ? r.data : []),
  })

  const upload = useMutation({
    mutationFn: (file: File) => filesApi.upload(file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['files'] }),
  })

  const remove = useMutation({
    mutationFn: (id: string) => filesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['files'] }),
  })

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    const res = await filesApi.search(query.trim())
    setSearchResults(res.data ?? [])
    setSearching(false)
  }

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900">Files</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload PDFs and notes — they&apos;re indexed for semantic search automatically.
        </p>
      </div>

      {/* Upload */}
      <Card className="bg-white/80 backdrop-blur-md border-white/50 shadow-glass rounded-2xl">
        <CardContent className="p-6">
          <h2 className="mb-4 text-sm font-semibold text-primary-800">Upload a file</h2>
          <FileUploadZone
            onUpload={(file) => upload.mutate(file)}
            uploading={upload.isPending}
          />
          {upload.isError && (
            <p className="mt-2 text-xs text-destructive">Upload failed — please try again.</p>
          )}
          {upload.isSuccess && (
            <p className="mt-2 text-xs text-primary-600">File uploaded and indexed.</p>
          )}
        </CardContent>
      </Card>

      {/* Semantic search */}
      <Card className="bg-white/80 backdrop-blur-md border-white/50 shadow-glass rounded-2xl">
        <CardContent className="p-6">
          <h2 className="mb-4 text-sm font-semibold text-primary-800">Semantic search</h2>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search across all your files…"
                className="pl-9"
              />
            </div>
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

      {/* File list */}
      <Card className="bg-white/80 backdrop-blur-md border-white/50 shadow-glass rounded-2xl">
        <CardContent className="p-6">
          <h2 className="mb-4 text-sm font-semibold text-primary-800">
            Your files {data && `(${data.length})`}
          </h2>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-primary-50" />
              ))}
            </div>
          ) : data?.length === 0 ? (
            <p className="text-sm text-muted-foreground">No files yet — upload one above.</p>
          ) : (
            <div className="space-y-2">
              {data?.map((file) => (
                <FileRow
                  key={file.id}
                  file={file}
                  onDelete={() => remove.mutate(file.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
