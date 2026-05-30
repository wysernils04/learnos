'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Brain, Calendar, Clock, BookOpen, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StreakCalendar } from '@/components/StreakCalendar'
import { analyticsApi, type Dashboard } from '@/lib/api'

export function DashboardStats() {
  const { data: dashData, isLoading: dashLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: analyticsApi.dashboard,
    staleTime: 60_000,
  })

  const { data: streakData } = useQuery({
    queryKey: ['streak'],
    queryFn: analyticsApi.streak,
    staleTime: 60_000,
  })

  const d: Dashboard | null = dashData?.data ?? null
  const streakDays = streakData?.data ?? []

  if (dashLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-5 pb-5">
              <div className="h-16 bg-primary-50 rounded-xl animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const nextExamLabel = d?.next_exam
    ? new Date(d.next_exam.exam_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : '—'

  const nextExamSub = d?.next_exam
    ? `${d.next_exam.exam_name} · ${d.readiness_score ?? 0}% ready`
    : 'set an exam to track'

  const avgLabel = d
    ? `7-day avg: ${Math.round(d.study_time_7d_avg_minutes)} min`
    : '7-day avg: —'

  return (
    <div className="space-y-8">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Brain}
          label="Due today"
          value={d ? String(d.due_today) : '—'}
          sub="topics to review"
          color="text-primary-600 bg-primary-100"
          href="/queue"
        />
        <StatCard
          icon={BookOpen}
          label="Flashcards due"
          value={d ? String(d.due_flashcards) : '—'}
          sub="cards ready"
          color="text-primary-500 bg-primary-50"
        />
        <StatCard
          icon={Calendar}
          label="Next exam"
          value={nextExamLabel}
          sub={nextExamSub}
          color="text-cta bg-orange-50"
        />
        <StatCard
          icon={Clock}
          label="Study time today"
          value={d ? `${d.study_time_today_minutes} min` : '—'}
          sub={avgLabel}
          color="text-primary-600 bg-primary-50"
        />
      </div>

      {/* Review queue call-to-action */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Review queue</CardTitle>
            {d && d.due_today > 0 && (
              <Button asChild size="sm">
                <Link href="/queue">
                  Start review ({d.due_today})
                </Link>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!d || d.due_today === 0 ? (
            <p className="text-muted-foreground text-sm">
              No topics due today. Log your first lecture on the{' '}
              <Link href="/topics" className="text-primary-600 underline underline-offset-2 hover:text-primary-700">
                Topics
              </Link>{' '}
              page to start your learning queue.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              You have <strong className="text-foreground">{d.due_today} topic{d.due_today !== 1 ? 's' : ''}</strong> waiting for review.
              {d.due_flashcards > 0 && (
                <> Plus <strong className="text-foreground">{d.due_flashcards} flashcard{d.due_flashcards !== 1 ? 's' : ''}</strong>.</>
              )}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Streak calendar */}
      <Card>
        <CardHeader>
          <CardTitle>Study streak</CardTitle>
        </CardHeader>
        <CardContent>
          {streakDays.length === 0 && !d?.current_streak ? (
            <p className="text-muted-foreground text-sm">
              No reviews yet. Complete your first review to start your streak.
            </p>
          ) : (
            <StreakCalendar data={streakDays} streak={d?.current_streak ?? 0} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  href,
}: {
  icon: React.ElementType
  label: string
  value: string
  sub: string
  color: string
  href?: string
}) {
  const inner = (
    <CardContent className="pt-5 pb-5">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
          <Icon className="w-5 h-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-foreground leading-tight">{value}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
        </div>
      </div>
    </CardContent>
  )

  if (href) {
    return (
      <Card className="cursor-pointer transition-shadow hover:shadow-glass-lg">
        <Link href={href} aria-label={`${label}: ${value}`}>{inner}</Link>
      </Card>
    )
  }
  return <Card>{inner}</Card>
}
