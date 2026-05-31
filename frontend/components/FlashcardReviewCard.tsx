'use client'

import { useState } from 'react'
import { ChevronRight, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { Flashcard } from '@/lib/api'

interface Props {
  card: Flashcard
  position: number
  total: number
  topicName?: string
  onReviewed: (cardId: string, quality: number) => void
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

export function FlashcardReviewCard({ card, position, total, topicName, onReviewed, isPending }: Props) {
  const [flipped, setFlipped] = useState(false)

  return (
    <Card className="w-full max-w-2xl mx-auto animate-fade-in">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-medium uppercase tracking-wide">{topicName ?? 'Flashcard'}</span>
          <span>{position} / {total}</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Question */}
        <div className="min-h-[80px] flex items-start gap-3">
          <div className="mt-0.5 w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
            <Lightbulb className="w-5 h-5 text-primary-600" aria-hidden="true" />
          </div>
          <p className="text-xl font-bold text-foreground leading-snug">{card.question}</p>
        </div>

        {/* Answer (revealed on flip) */}
        {flipped && (
          <div className="rounded-xl border border-primary-100 bg-primary-50/60 px-4 py-3">
            <p className="text-xs font-semibold text-primary-500 mb-1">Answer</p>
            <p className="text-base text-primary-900 leading-relaxed whitespace-pre-wrap">{card.answer}</p>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Ease {card.easiness_factor.toFixed(2)}</span>
          <span>·</span>
          <span>Interval {card.sm2_interval}d</span>
          <span>·</span>
          <span>Reps {card.sm2_repetitions}</span>
        </div>

        {!flipped ? (
          <Button className="w-full" onClick={() => setFlipped(true)} size="lg">
            Show answer
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </Button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground font-medium">How well did you recall this?</p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {QUALITY_BUTTONS.map(({ q, label, color }) => (
                <button
                  key={q}
                  onClick={() => onReviewed(card.id, q)}
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
