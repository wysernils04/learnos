'use client'

import { useState } from 'react'
import { Brain, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { QueueItem } from '@/lib/api'

interface ReviewCardProps {
  item: QueueItem
  queuePosition: number
  queueTotal: number
  onReviewed: (topicId: string, quality: number) => void
  isPending?: boolean
}

const QUALITY_BUTTONS = [
  { q: 0, label: 'Blackout', color: 'bg-red-100 text-red-700 hover:bg-red-200 border-red-200' },
  { q: 1, label: 'Wrong',    color: 'bg-red-50 text-red-600 hover:bg-red-100 border-red-100' },
  { q: 2, label: 'Hard',     color: 'bg-orange-50 text-orange-600 hover:bg-orange-100 border-orange-100' },
  { q: 3, label: 'OK',       color: 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-100' },
  { q: 4, label: 'Good',     color: 'bg-teal-50 text-teal-700 hover:bg-teal-100 border-teal-100' },
  { q: 5, label: 'Perfect',  color: 'bg-primary-100 text-primary-900 hover:bg-primary-200 border-primary-200' },
] as const

export function ReviewCard({ item, queuePosition, queueTotal, onReviewed, isPending }: ReviewCardProps) {
  const [flipped, setFlipped] = useState(false)
  const { topic } = item

  return (
    <Card className="w-full max-w-2xl mx-auto animate-fade-in">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-medium uppercase tracking-wide">{topic.module}</span>
          <span>{queuePosition} / {queueTotal}</span>
        </div>
        {item.overdue_days > 0 && (
          <p className="text-xs text-cta font-medium mt-1">
            {item.overdue_days} day{item.overdue_days !== 1 ? 's' : ''} overdue
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="min-h-[80px] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
            <Brain className="w-5 h-5 text-primary-600" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-bold text-foreground leading-snug">{topic.name}</h2>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Ease {topic.easiness_factor.toFixed(2)}</span>
          <span>·</span>
          <span>Interval {topic.sm2_interval}d</span>
          <span>·</span>
          <span>Reps {topic.sm2_repetitions}</span>
        </div>

        {!flipped ? (
          <Button
            className="w-full"
            onClick={() => setFlipped(true)}
            size="lg"
          >
            Show answer
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </Button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground font-medium">
              How well did you recall this?
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {QUALITY_BUTTONS.map(({ q, label, color }) => (
                <button
                  key={q}
                  onClick={() => onReviewed(topic.id, q)}
                  disabled={isPending}
                  aria-label={`Quality ${q}: ${label}`}
                  className={cn(
                    'flex flex-col items-center justify-center rounded-xl border px-2 py-3 text-xs font-semibold',
                    'transition-colors duration-150 cursor-pointer',
                    'disabled:pointer-events-none disabled:opacity-50',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    color,
                  )}
                >
                  <span className="text-base font-bold leading-none mb-0.5">{q}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
