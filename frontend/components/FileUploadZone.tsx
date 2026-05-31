'use client'

import { useCallback, useRef, useState } from 'react'
import { Upload, X, FileText, Music } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const ACCEPTED = ['.pdf', '.txt', '.mp3', '.m4a', '.wav', '.ogg']
const MAX_MB = 50

interface Props {
  onUpload: (file: File) => void
  uploading?: boolean
}

function fileIcon(type: string) {
  if (type.startsWith('audio/') || /\.(mp3|m4a|wav|ogg)$/i.test(type))
    return <Music className="h-5 w-5 text-primary-500" />
  return <FileText className="h-5 w-5 text-primary-500" />
}

export function FileUploadZone({ onUpload, uploading = false }: Props) {
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function validate(file: File): string | null {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!ACCEPTED.includes(ext)) return `Unsupported type. Allowed: ${ACCEPTED.join(', ')}`
    if (file.size > MAX_MB * 1024 * 1024) return `File exceeds ${MAX_MB} MB`
    return null
  }

  function pick(file: File) {
    const err = validate(file)
    if (err) { setError(err); return }
    setError(null)
    setPendingFile(file)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) pick(file)
  }, [])

  function handleUpload() {
    if (pendingFile) {
      onUpload(pendingFile)
      setPendingFile(null)
    }
  }

  function clear() {
    setPendingFile(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="space-y-3">
      {!pendingFile ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10',
            'cursor-pointer transition-colors duration-200',
            dragging
              ? 'border-primary-400 bg-primary-50'
              : 'border-primary-200 bg-white/60 hover:border-primary-300 hover:bg-primary-50/50',
          )}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100">
            <Upload className="h-6 w-6 text-primary-600" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-primary-800">
              Drop a file or click to browse
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              PDF, TXT, MP3, M4A, WAV, OGG — up to {MAX_MB} MB
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(',')}
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f) }}
          />
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border border-primary-200 bg-white/80 px-4 py-3 backdrop-blur-sm">
          {fileIcon(pendingFile.type || pendingFile.name)}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-primary-900">{pendingFile.name}</p>
            <p className="text-xs text-muted-foreground">
              {(pendingFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
          <button
            onClick={clear}
            className="cursor-pointer rounded-lg p-1 text-muted-foreground transition-colors duration-150 hover:bg-primary-50 hover:text-primary-700"
            aria-label="Remove file"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {pendingFile && (
        <Button
          onClick={handleUpload}
          loading={uploading}
          disabled={uploading}
          className="w-full"
        >
          {uploading ? 'Uploading & indexing…' : 'Upload & index'}
        </Button>
      )}
    </div>
  )
}
