'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, Eye, EyeOff, Key, Trash2 } from 'lucide-react'
import { settingsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function SettingsPage() {
  const qc = useQueryClient()
  const [key, setKey] = useState('')
  const [show, setShow] = useState(false)
  const [saved, setSaved] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.get().then((r) => r.data ?? null),
  })

  const saveKey = useMutation({
    mutationFn: () => settingsApi.saveApiKey(key),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      setKey('')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  const deleteKey = useMutation({
    mutationFn: settingsApi.deleteApiKey,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  })

  return (
    <div className="space-y-8 p-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-primary-900">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your account preferences.</p>
      </div>

      {/* Anthropic API Key */}
      <Card className="bg-white/80 backdrop-blur-md border-white/50 shadow-glass rounded-2xl">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-100">
              <Key className="h-4 w-4 text-primary-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-primary-900">Anthropic API key</h2>
              <p className="text-xs text-muted-foreground">
                Required for auto quiz generation. Stored encrypted — never exposed.
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="h-10 animate-pulse rounded-xl bg-primary-50" />
          ) : data?.has_key ? (
            <div className="flex items-center gap-3 rounded-xl border border-primary-100 bg-primary-50 px-4 py-3">
              <CheckCircle className="h-4 w-4 shrink-0 text-primary-600" />
              <p className="flex-1 text-sm font-medium text-primary-800">API key saved</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => deleteKey.mutate()}
                loading={deleteKey.isPending}
                className="text-destructive hover:bg-red-50 hover:text-red-600 hover:border-red-200"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Remove
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="api-key">Paste your key (starts with sk-ant-)</Label>
                <div className="relative">
                  <Input
                    id="api-key"
                    type={show ? 'text' : 'password'}
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder="sk-ant-api03-..."
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-primary-700 transition-colors duration-150"
                    aria-label={show ? 'Hide key' : 'Show key'}
                  >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button
                onClick={() => saveKey.mutate()}
                loading={saveKey.isPending}
                disabled={saveKey.isPending || !key.startsWith('sk-ant-')}
                className="w-full"
              >
                Save key
              </Button>
              {saveKey.isError && (
                <p className="text-xs text-destructive">
                  {(saveKey.error as Error)?.message ?? 'Failed to save key.'}
                </p>
              )}
              {saved && <p className="text-xs text-primary-600">Key saved successfully.</p>}
              <p className="text-xs text-muted-foreground">
                Get your key at{' '}
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 underline hover:text-primary-800"
                >
                  console.anthropic.com
                </a>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
