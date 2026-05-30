import { createClient } from '@/lib/supabase-server'
import { DashboardStats } from './stats'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const firstName = user?.email?.split('@')[0] ?? 'Student'

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-primary-900">
          Good morning, {firstName}
        </h1>
        <p className="text-muted-foreground mt-1">Here&apos;s your study briefing for today.</p>
      </div>

      <DashboardStats />
    </div>
  )
}
