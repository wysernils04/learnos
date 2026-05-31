'use client'

import { useState } from 'react'
import { CheckCircle, XCircle } from 'lucide-react'
import { quizApi, type QuizQuestion } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  questions: QuizQuestion[]
  topicId: string
  onFinish: (scorePercent: number) => void
}

export function QuizRunner({ questions, topicId, onFinish }: Props) {
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [shortAnswer, setShortAnswer] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [correct, setCorrect] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const q = questions[index]
  const isLast = index === questions.length - 1

  function isCorrect(answer: string): boolean {
    return answer.trim().toLowerCase() === q.answer.trim().toLowerCase()
  }

  function handleReveal() {
    const ans = q.question_type === 'short_answer' ? shortAnswer : (selected ?? '')
    if (isCorrect(ans)) setCorrect((c) => c + 1)
    setRevealed(true)
  }

  async function handleNext() {
    if (isLast) {
      const totalCorrect = correct + (isCorrect(q.question_type === 'short_answer' ? shortAnswer : (selected ?? '')) ? 0 : 0)
      // correct was already incremented in handleReveal
      const pct = Math.round((correct / questions.length) * 100)
      setSubmitting(true)
      await quizApi.submitResult(topicId, pct)
      setSubmitting(false)
      onFinish(pct)
    } else {
      setIndex((i) => i + 1)
      setSelected(null)
      setShortAnswer('')
      setRevealed(false)
    }
  }

  const answerGiven = q.question_type === 'short_answer' ? shortAnswer.trim() !== '' : selected !== null

  return (
    <div className="space-y-5">
      {/* Progress */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{index + 1} / {questions.length}</span>
        <span>{correct} correct</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-primary-100">
        <div
          className="h-1.5 rounded-full bg-primary-500 transition-all duration-300"
          style={{ width: `${(index / questions.length) * 100}%` }}
        />
      </div>

      {/* Question */}
      <div className="rounded-xl border border-white/50 bg-white/60 px-5 py-4 backdrop-blur-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          {q.question_type.replace('_', ' ')}
        </p>
        <p className="text-base font-semibold text-primary-900 leading-snug">{q.question}</p>
      </div>

      {/* Answer area */}
      {q.question_type === 'multiple_choice' && q.options && (
        <div className="space-y-2">
          {q.options.map((opt) => {
            const isSelected = selected === opt.text
            const isRight = revealed && opt.text.toLowerCase() === q.answer.toLowerCase()
            const isWrong = revealed && isSelected && !isRight
            return (
              <button
                key={opt.label}
                onClick={() => !revealed && setSelected(opt.text)}
                disabled={revealed}
                className={cn(
                  'w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors duration-150 cursor-pointer',
                  'disabled:cursor-default',
                  isRight ? 'border-primary-300 bg-primary-50 text-primary-800' :
                  isWrong ? 'border-red-200 bg-red-50 text-red-800' :
                  isSelected ? 'border-primary-300 bg-primary-50 text-primary-800' :
                  'border-input bg-white/80 hover:border-primary-200 hover:bg-primary-50/50 text-foreground',
                )}
              >
                <span className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                  isRight ? 'bg-primary-200 text-primary-700' :
                  isWrong ? 'bg-red-200 text-red-700' :
                  isSelected ? 'bg-primary-200 text-primary-700' :
                  'bg-slate-100 text-slate-600',
                )}>
                  {opt.label}
                </span>
                <span className="flex-1">{opt.text}</span>
                {revealed && isRight && <CheckCircle className="h-4 w-4 shrink-0 text-primary-600" />}
                {revealed && isWrong && <XCircle className="h-4 w-4 shrink-0 text-red-500" />}
              </button>
            )
          })}
        </div>
      )}

      {q.question_type === 'true_false' && (
        <div className="flex gap-3">
          {['True', 'False'].map((val) => {
            const isSelected = selected === val
            const isRight = revealed && val === q.answer
            const isWrong = revealed && isSelected && !isRight
            return (
              <button
                key={val}
                onClick={() => !revealed && setSelected(val)}
                disabled={revealed}
                className={cn(
                  'flex-1 rounded-xl border py-3 text-sm font-semibold transition-colors duration-150 cursor-pointer disabled:cursor-default',
                  isRight ? 'border-primary-300 bg-primary-50 text-primary-800' :
                  isWrong ? 'border-red-200 bg-red-50 text-red-700' :
                  isSelected ? 'border-primary-300 bg-primary-50 text-primary-800' :
                  'border-input bg-white/80 hover:border-primary-200 text-foreground',
                )}
              >
                {val}
              </button>
            )
          })}
        </div>
      )}

      {q.question_type === 'short_answer' && (
        <textarea
          value={shortAnswer}
          onChange={(e) => setShortAnswer(e.target.value)}
          disabled={revealed}
          rows={3}
          placeholder="Type your answer…"
          className="w-full rounded-xl border border-input bg-white/80 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none disabled:opacity-60"
        />
      )}

      {/* Revealed answer */}
      {revealed && (
        <div className={cn(
          'rounded-xl border px-4 py-3',
          isCorrect(q.question_type === 'short_answer' ? shortAnswer : (selected ?? ''))
            ? 'border-primary-200 bg-primary-50'
            : 'border-orange-200 bg-orange-50',
        )}>
          <p className="text-xs font-semibold text-muted-foreground mb-1">Correct answer</p>
          <p className="text-sm font-medium text-primary-900">{q.answer}</p>
        </div>
      )}

      {/* Actions */}
      {!revealed ? (
        <Button
          className="w-full"
          onClick={handleReveal}
          disabled={!answerGiven}
        >
          Check answer
        </Button>
      ) : (
        <Button className="w-full" onClick={handleNext} loading={submitting}>
          {isLast ? 'Finish quiz' : 'Next question'}
        </Button>
      )}
    </div>
  )
}
