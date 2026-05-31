'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Train, Settings2, ArrowRight } from 'lucide-react'
import { sbbApi, type SbbConnection } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'

const LS_FROM = 'sbb_from'
const LS_TO = 'sbb_to'

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function parseDuration(d: string) {
  // "00d02:15:00" → "2h 15m" or just "15m"
  const match = d.match(/(\d+)d(\d+):(\d+):/)
  if (!match) return d
  const days = parseInt(match[1])
  const hrs = parseInt(match[2])
  const mins = parseInt(match[3])
  const parts = []
  if (days > 0) parts.push(`${days}d`)
  if (hrs > 0) parts.push(`${hrs}h`)
  if (mins > 0) parts.push(`${mins}m`)
  return parts.join(' ') || '< 1m'
}

export function SbbWidget() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [configuring, setConfiguring] = useState(false)
  const [draftFrom, setDraftFrom] = useState('')
  const [draftTo, setDraftTo] = useState('')

  useEffect(() => {
    const f = localStorage.getItem(LS_FROM) ?? ''
    const t = localStorage.getItem(LS_TO) ?? ''
    setFrom(f)
    setTo(t)
    if (!f || !t) setConfiguring(true)
  }, [])

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['sbb', from, to],
    queryFn: () => sbbApi.connections(from, to).then((r) => r.data),
    enabled: !!from && !!to,
    staleTime: 60_000,
  })

  function saveConfig() {
    const f = draftFrom.trim()
    const t = draftTo.trim()
    if (!f || !t) return
    localStorage.setItem(LS_FROM, f)
    localStorage.setItem(LS_TO, t)
    setFrom(f)
    setTo(t)
    setConfiguring(false)
  }

  const connections: SbbConnection[] = data?.connections ?? []

  return (
    <Card className="bg-white/80 backdrop-blur-md border-white/50 shadow-glass rounded-2xl">
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Train className="h-4 w-4 text-primary-500" />
            <h2 className="text-sm font-semibold text-primary-800">Next connections</h2>
          </div>
          <button
            onClick={() => { setDraftFrom(from); setDraftTo(to); setConfiguring(!configuring) }}
            className="cursor-pointer rounded-lg p-1.5 text-muted-foreground hover:bg-primary-50 hover:text-primary-700 transition-colors duration-150"
            aria-label="Configure stations"
          >
            <Settings2 className="h-4 w-4" />
          </button>
        </div>

        {configuring ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">From (home station)</label>
              <Input
                value={draftFrom}
                onChange={(e) => setDraftFrom(e.target.value)}
                placeholder="e.g. Zürich HB"
                onKeyDown={(e) => e.key === 'Enter' && saveConfig()}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">To (university station)</label>
              <Input
                value={draftTo}
                onChange={(e) => setDraftTo(e.target.value)}
                placeholder="e.g. ETH/Universitätsspital"
                onKeyDown={(e) => e.key === 'Enter' && saveConfig()}
              />
            </div>
            <Button size="sm" className="w-full" onClick={saveConfig} disabled={!draftFrom.trim() || !draftTo.trim()}>
              Save stations
            </Button>
          </div>
        ) : !from || !to ? (
          <p className="text-xs text-muted-foreground">Configure your home and university stations above.</p>
        ) : isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded-xl bg-primary-50" />)}
          </div>
        ) : connections.length === 0 ? (
          <p className="text-xs text-muted-foreground">No connections found. Check station names.</p>
        ) : (
          <div className="space-y-2">
            {connections.map((c, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl border border-primary-100 bg-primary-50/60 px-3 py-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-primary-900">
                  <span>{formatTime(c.from.departure)}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{formatTime(c.to.arrival)}</span>
                </div>
                <span className="text-xs text-muted-foreground">{parseDuration(c.duration)}</span>
              </div>
            ))}
            <button
              onClick={() => refetch()}
              className="cursor-pointer text-xs text-primary-600 hover:text-primary-800 transition-colors duration-150 mt-1"
            >
              Refresh
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
