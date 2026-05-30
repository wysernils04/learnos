import { Brain, Calendar, Clock, BookOpen } from 'lucide-react'
import { createClient } from '@/lib/supabase-server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const firstName = user?.email?.split('@')[0] ?? 'Student'

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-primary-900">
          Good morning, {firstName} 👋
        </h1>
        <p className="text-muted-foreground mt-1">Here&apos;s your study briefing for today.</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Brain}
          label="Due today"
          value="—"
          sub="topics to review"
          color="text-primary-600 bg-primary-100"
        />
        <StatCard
          icon={BookOpen}
          label="Flashcards due"
          value="—"
          sub="cards ready"
          color="text-secondary-600 bg-primary-100"
        />
        <StatCard
          icon={Calendar}
          label="Next exam"
          value="—"
          sub="set an exam to track"
          color="text-cta bg-orange-50"
        />
        <StatCard
          icon={Clock}
          label="Study time today"
          value="0 min"
          sub="7-day avg: —"
          color="text-primary-600 bg-primary-50"
        />
      </div>

      {/* Placeholder for Phase 2 content */}
      <Card>
        <CardHeader>
          <CardTitle>Review Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No topics due yet. Log your first lecture using the <strong>Topics</strong> page to start your learning queue.
          </p>
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
}: {
  icon: React.ElementType
  label: string
  value: string
  sub: string
  color: string
}) {
  return (
    <Card>
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
    </Card>
  )
}
