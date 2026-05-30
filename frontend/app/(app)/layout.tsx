import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'
import { createClient } from '@/lib/supabase-server'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100">
      <Sidebar userEmail={user.email ?? ''} />
      <main className="pl-64">
        <div className="max-w-6xl mx-auto px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
