'use client'

import { useQuery } from '@tanstack/react-query'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { analyticsApi } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'

// ── Design tokens ─────────────────────────────────────────────────────────────

const TEAL = '#0D9488'
const TEAL_LIGHT = '#99F6E4'
const ORANGE = '#F97316'
const MUTED = '#94A3B8'

const DUE_COLORS: Record<string, string> = {
  Overdue: '#EF4444',
  Today: '#F97316',
  'This week': '#EAB308',
  'Next week': '#0D9488',
  Later: '#CBD5E1',
}

// ── Helper ────────────────────────────────────────────────────────────────────

function shortDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{children}</h2>
}

function ChartCard({ title, children, empty, emptyMsg = 'No data yet.' }: {
  title: string
  children: React.ReactNode
  empty?: boolean
  emptyMsg?: string
}) {
  return (
    <Card className="bg-white/80 backdrop-blur-md border-white/50 shadow-glass rounded-2xl">
      <CardContent className="p-5">
        <p className="text-sm font-semibold text-primary-800 mb-4">{title}</p>
        {empty
          ? <p className="py-8 text-center text-sm text-muted-foreground">{emptyMsg}</p>
          : children}
      </CardContent>
    </Card>
  )
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label, unit = '' }: {
  active?: boolean; payload?: { value: number; name?: string }[]; label?: string; unit?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-white/50 bg-white/95 px-3 py-2 shadow-glass text-xs backdrop-blur-sm">
      <p className="font-semibold text-primary-800 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-muted-foreground">
          {p.name ? `${p.name}: ` : ''}<span className="font-bold text-primary-900">{p.value}{unit}</span>
        </p>
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { data: streak = [] } = useQuery({
    queryKey: ['analytics-streak'],
    queryFn: () => analyticsApi.streak().then((r) => r.data ?? []),
  })

  const { data: modules = [] } = useQuery({
    queryKey: ['analytics-modules'],
    queryFn: () => analyticsApi.modules().then((r) => r.data ?? []),
  })

  const { data: quizHistory = [] } = useQuery({
    queryKey: ['analytics-quiz'],
    queryFn: () => analyticsApi.quizHistory().then((r) => r.data ?? []),
  })

  const { data: topicsDue = [] } = useQuery({
    queryKey: ['analytics-due'],
    queryFn: () => analyticsApi.topicsDue().then((r) => r.data ?? []),
  })

  // Last 28 days of streak (most recent on right)
  const streakData = [...streak]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-28)
    .map((d) => ({ date: shortDate(d.date), reviews: d.topics_reviewed }))

  const moduleData = modules.map((m) => ({
    module: m.module.length > 14 ? m.module.slice(0, 14) + '…' : m.module,
    understanding: Math.round(m.avg_understanding * 10) / 10,
    topics: m.topic_count,
  }))

  const quizData = quizHistory.map((q) => ({
    date: shortDate(q.date),
    score: q.avg_score,
  }))

  const dueData = topicsDue.map((d) => ({
    name: d.bucket,
    value: d.count,
    color: DUE_COLORS[d.bucket] ?? MUTED,
  }))

  const totalTopics = topicsDue.reduce((s, d) => s + d.count, 0)

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your learning patterns at a glance.</p>
      </div>

      {/* Activity */}
      <section>
        <SectionTitle>Daily activity — last 28 days</SectionTitle>
        <ChartCard title="Topics reviewed per day" empty={streakData.length === 0} emptyMsg="Start reviewing topics to see activity.">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={streakData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: MUTED }}
                tickLine={false}
                axisLine={false}
                interval={6}
              />
              <YAxis tick={{ fontSize: 10, fill: MUTED }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="reviews" name="Reviews" fill={TEAL} radius={[4, 4, 0, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      {/* Two-column grid */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* Module understanding */}
        <section>
          <SectionTitle>Understanding by module</SectionTitle>
          <ChartCard title="Avg understanding score (1–5)" empty={moduleData.length === 0} emptyMsg="Add topics to see module breakdown.">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={moduleData} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 10, fill: MUTED }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="module" tick={{ fontSize: 10, fill: '#134E4A' }} tickLine={false} axisLine={false} width={80} />
                <Tooltip content={<CustomTooltip unit="/5" />} />
                <Bar dataKey="understanding" name="Understanding" radius={[0, 4, 4, 0]} maxBarSize={18}>
                  {moduleData.map((entry, i) => (
                    <Cell key={i} fill={entry.understanding >= 4 ? TEAL : entry.understanding >= 3 ? ORANGE : '#EF4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </section>

        {/* Topics due breakdown */}
        <section>
          <SectionTitle>Review schedule</SectionTitle>
          <ChartCard title="Topics by due date" empty={dueData.length === 0} emptyMsg="Add topics to see the schedule.">
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={180}>
                <PieChart>
                  <Pie
                    data={dueData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                  >
                    {dueData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0]
                      return (
                        <div className="rounded-xl border border-white/50 bg-white/95 px-3 py-2 shadow-glass text-xs backdrop-blur-sm">
                          <p className="font-bold text-primary-900">{d.name}: {d.value}</p>
                        </div>
                      )
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {dueData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                      <span className="text-xs text-primary-800">{d.name}</span>
                    </div>
                    <span className="text-xs font-bold text-primary-900">
                      {d.value} <span className="font-normal text-muted-foreground">({Math.round((d.value / totalTopics) * 100)}%)</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </ChartCard>
        </section>
      </div>

      {/* Quiz performance */}
      <section>
        <SectionTitle>Quiz performance — last 30 days</SectionTitle>
        <ChartCard title="Average quiz score (%)" empty={quizData.length === 0} emptyMsg="Generate and complete quizzes to see performance trends.">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={quizData} margin={{ top: 4, right: 12, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: MUTED }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: MUTED }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip unit="%" />} />
              <Line
                type="monotone"
                dataKey="score"
                name="Score"
                stroke={TEAL}
                strokeWidth={2.5}
                dot={{ r: 4, fill: TEAL, strokeWidth: 0 }}
                activeDot={{ r: 6, fill: TEAL }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>
    </div>
  )
}
